/*  sqlite3_storage.cc - this file is part of MediaTomb.

    Copyright (C) 2005 Gena Batyan <bgeradz@deadlock.dhs.org>,
                       Sergey Bostandzhyan <jin@deadlock.dhs.org>

    MediaTomb is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    MediaTomb is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with MediaTomb; if not, write to the Free Software
    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

#ifdef HAVE_CONFIG_H
    #include "autoconfig.h"
#endif

#ifdef HAVE_SQLITE3

#include "sqlite3_storage.h"

#include "common.h"
#include "config_manager.h"

#ifdef AUTO_CREATE_DATABASE
    #include "sqlite3_create_sql.h"
    #include <zlib.h>
#endif

#define SL3_INITITAL_QUEUE_SIZE 20

using namespace zmm;
using namespace mxml;

Sqlite3Storage::Sqlite3Storage() : SQLStorage()
{
    shutdownFlag = false;
    dbRemovesDeps = false;
    table_quote_begin = '"';
    table_quote_end = '"';
    startupError = nil;
    mutex = Ref<Mutex>(new Mutex());
    cond = Ref<Cond>(new Cond(mutex));
}

void Sqlite3Storage::init()
{
    int ret;
    
    mutex->lock();
    /*
    pthread_attr_t attr;
    pthread_attr_init(&attr);
    pthread_attr_setdetachstate(&attr, PTHREAD_CREATE_DETACHED);
    */
    
    taskQueue = Ref<ObjectQueue<SLTask> >(new ObjectQueue<SLTask>(SL3_INITITAL_QUEUE_SIZE));
    taskQueueOpen = true;
    
    ret = pthread_create(
        &sqliteThread,
        NULL, //&attr,
        Sqlite3Storage::staticThreadProc,
        this
    );
    
    cond->wait();
    mutex->unlock();
    
    if (startupError != nil)
        throw _StorageException(startupError);
    
    
    String dbVersion = nil;
    try
    {
        dbVersion = getInternalSetting(_("db_version"));
    }
    catch (Exception)
    {
    }
    if (dbVersion == nil)
    {
#ifdef AUTO_CREATE_DATABASE
        log_info("database doesn't seem to exist. automatically creating database...\n");
        Ref<SLInitTask> ptask (new SLInitTask());
        addTask(RefCast(ptask, SLTask));
        ptask->waitForTask();
        dbVersion = getInternalSetting(_("db_version"));
        if (dbVersion == nil)
        {
            shutdown();
            throw _Exception(_("error while creating database"));
        }
        log_info("database created successfully.\n");
#else
        shutdown();
        throw _Exception(_("database doesn't seem to exist yet and autocreation wasn't compiled in"));
#endif
    }
    log_debug("db_version: %s\n", dbVersion.c_str());
    
    //pthread_attr_destroy(&attr);
    
    SQLStorage::init();
}

String Sqlite3Storage::quote(String value)
{
    char *q = sqlite3_mprintf("'%q'",
        (value == nil ? "" : value.c_str()));
    String ret(q);
    sqlite3_free(q);
    return ret;
}

String Sqlite3Storage::getError(String query, sqlite3 *db)
{
    return _("SQLITE3: (") + sqlite3_errcode(db) + ") " 
        + sqlite3_errmsg(db) +"\nQuery:" + (query == nil ? _("unknown") : query);
}

Ref<SQLResult> Sqlite3Storage::select(String query)
{
    Ref<SLSelectTask> ptask (new SLSelectTask(query));
    addTask(RefCast(ptask, SLTask));
    ptask->waitForTask();
    return ptask->getResult();
}

int Sqlite3Storage::exec(String query, bool getLastInsertId)
{
    Ref<SLExecTask> ptask (new SLExecTask(query, getLastInsertId));
    addTask(RefCast(ptask, SLTask));
    ptask->waitForTask();
    if (getLastInsertId) return ptask->getLastInsertId();
    else return -1;
}


void *Sqlite3Storage::staticThreadProc(void *arg)
{
    Sqlite3Storage *inst = (Sqlite3Storage *)arg;
    inst->threadProc();
    log_debug("Sqlite3Storage::staticThreadProc - exiting thread\n");
    pthread_exit(NULL);
    return NULL;
}

void Sqlite3Storage::threadProc()
{
    Ref<SLTask> task;
    
    sqlite3 *db;
    
    Ref<ConfigManager> config = ConfigManager::getInstance();
    
    String dbFilePath = config->getOption(_("/server/storage/database-file"));
    
    int res = sqlite3_open(dbFilePath.c_str(), &db);
    if(res != SQLITE_OK)
    {
        startupError = _("Sqlite3Storage.init: could not open ") +
            dbFilePath;
    }
    
    cond->signal();
    
    while(! shutdownFlag)
    {
        lock();
        if((task = taskQueue->dequeue()) == nil)
        {
            /* if nothing to do, sleep until awakened */
            cond->wait();
            unlock();
            continue;
        }
        unlock();
        
        try
        {
            task->run(db, this);
            task->sendSignal();
        }
        catch (Exception e)
        {
            task->sendSignal(e.getMessage());
        }
    }
    lock();
    taskQueueOpen = false;
    while((task = taskQueue->dequeue()) != nil)
    {
        task->sendSignal(_("Sorry, sqlite3 thread is shutting down"));
    }
    unlock();
    if (db)
        sqlite3_close(db);
}                                             

void Sqlite3Storage::addTask(zmm::Ref<SLTask> task)
{
    if (! taskQueueOpen)
        throw _Exception(_("sqlite3 task queue is already closed"));
    lock();
    if (! taskQueueOpen)
    {
        unlock();
        throw _Exception(_("sqlite3 task queue is already closed"));
    }
    taskQueue->enqueue(task);
    signal();
    unlock();
}

void Sqlite3Storage::shutdown()
{
    shutdownFlag = true;
    lock();
    signal();
    unlock();
    if (sqliteThread)
        pthread_join(sqliteThread, NULL);
    sqliteThread = 0;
}

void Sqlite3Storage::storeInternalSetting(String key, String value)
{
    Ref<StringBuffer> q(new StringBuffer());
    *q << "INSERT OR REPLACE INTO " << QTB << INTERNAL_SETTINGS_TABLE << QTE << " (" << QTB << "key" << QTE << ", " << QTB << "value" << QTE << ") "
    "VALUES (" << quote(key) << ", "<< quote(value) << ") ";
    this->exec(q->toString());
}


/* SLTask */

SLTask::SLTask() : Object()
{
    running = true;
    mutex = Ref<Mutex>(new Mutex());
    cond = Ref<Cond>(new Cond(mutex));
    error = nil;
}
bool SLTask::is_running()
{
    return running;
}

void SLTask::sendSignal()
{
    mutex->lock();
    running=false;
    cond->signal();
    mutex->unlock();
}

void SLTask::sendSignal(String error)
{
    this->error = error;
    sendSignal();
}

void SLTask::waitForTask()
{
    if (is_running())
    { // we check before we lock first, because there is no need to lock then
        mutex->lock();
        if (is_running())
        { // we check it a second time after locking to ensure we didn't miss the pthread_cond_signal 
            cond->wait(); // waiting for the task to complete
        }
        mutex->unlock();
    }
    
    if (getError() != nil)
    {
        //log_error("%s\n", getError().c_str());
        throw _Exception(getError());
    }
}

#ifdef AUTO_CREATE_DATABASE
/* SLInitTask */

void SLInitTask::run(sqlite3 *db, Sqlite3Storage *sl)
{
    unsigned char buf[SL2_CREATE_SQL_INFLATED_SIZE + 1]; // +1 for '\0' at the end of the string
    unsigned long uncompressed_size = SL2_CREATE_SQL_INFLATED_SIZE;
    int ret = uncompress(buf, &uncompressed_size, sqlite3_create_sql, SL2_CREATE_SQL_DEFLATED_SIZE);
    if (ret != Z_OK || uncompressed_size != SL2_CREATE_SQL_INFLATED_SIZE)
        throw _StorageException(_("Error while uncompressing sqlite3 create sql. returned: ") + ret);
    buf[SL2_CREATE_SQL_INFLATED_SIZE] = '\0';
    
    char *err;
    ret = sqlite3_exec(
        db,
        (char *)buf,
        NULL,
        NULL,
        &err
    );
    
    if(ret != SQLITE_OK)
    {
        throw _StorageException(sl->getError(nil, db));
    }
}

#endif

/* SLSelectTask */

SLSelectTask::SLSelectTask(zmm::String query) : SLTask()
{
    this->query = query;
}

void SLSelectTask::run(sqlite3 *db, Sqlite3Storage *sl)
{
    char *err;
    pres = Ref<Sqlite3Result>(new Sqlite3Result()); 
    
    int ret = sqlite3_get_table(
        db,
        query.c_str(),
        &pres->table,
        &pres->nrow,
        &pres->ncolumn,
        &err
    );
    
    if(ret != SQLITE_OK)
    {
        throw _StorageException(sl->getError(query, db));
    }

    pres->row = pres->table;
    pres->cur_row = 0;
}


/* SLExecTask */

SLExecTask::SLExecTask(zmm::String query, bool getLastInsertId) : SLTask()
{
    this->query = query;
    this->getLastInsertIdFlag = getLastInsertId;
}

void SLExecTask::run(sqlite3 *db, Sqlite3Storage *sl)
{
    char *err;
    int res = sqlite3_exec(
        db,
        query.c_str(),
        NULL,
        NULL,
        &err
    );
    if(res != SQLITE_OK)
    {
        throw _StorageException(sl->getError(query, db));
    }
    if (getLastInsertIdFlag)
        lastInsertId = sqlite3_last_insert_rowid(db);
}

/* Sqlite3Result */

Sqlite3Result::Sqlite3Result() : SQLResult()
{
    table = NULL;
}
Sqlite3Result::~Sqlite3Result()
{
    if(table)
    {
        sqlite3_free_table(table);
        table = NULL;
    }
}
Ref<SQLRow> Sqlite3Result::nextRow()
{
    if(nrow)
    {
        row += ncolumn;
        cur_row++;
        if (cur_row <= nrow)
        {
            Ref<Sqlite3Row> p (new Sqlite3Row(row, Ref<SQLResult>(this)));
            p->res = Ref<Sqlite3Result>(this);
            return RefCast(p, SQLRow);
        }
        else
            return nil;
    }
    return nil;

}

/* Sqlite3Row */

Sqlite3Row::Sqlite3Row(char **row, Ref<SQLResult> sqlResult) : SQLRow(sqlResult)
{
    this->row = row;
}
String Sqlite3Row::col(int index)
{
    return String(row[index]);
}


#endif // HAVE_SQlITE3

