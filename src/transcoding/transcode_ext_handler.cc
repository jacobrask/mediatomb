/*MT*
    
    MediaTomb - http://www.mediatomb.cc/
    
    transcode_ext_handler.cc - this file is part of MediaTomb.
    
    Copyright (C) 2005 Gena Batyan <bgeradz@mediatomb.cc>,
                       Sergey 'Jin' Bostandzhyan <jin@mediatomb.cc>
    
    Copyright (C) 2006-2007 Gena Batyan <bgeradz@mediatomb.cc>,
                            Sergey 'Jin' Bostandzhyan <jin@mediatomb.cc>,
                            Leonhard Wimmer <leo@mediatomb.cc>
    
    MediaTomb is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License version 2
    as published by the Free Software Foundation.
    
    MediaTomb is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
    
    You should have received a copy of the GNU General Public License
    version 2 along with MediaTomb; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA.
    
    $Id$
*/

/// \file transcode_ext_handler.cc

#ifdef HAVE_CONFIG_H
    #include "autoconfig.h"
#endif

#ifdef TRANSCODING

#include "transcode_ext_handler.h"
#include "server.h"
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <signal.h>
#include "common.h"
#include "storage.h"
#include "cds_objects.h"
#include "process.h"
#include "update_manager.h"
#include "session_manager.h"
#include "ixml.h"
#include "process_io_handler.h"
#include "buffered_io_handler.h"
#include "dictionary.h"
#include "metadata_handler.h"
#include "tools.h"

#include "file_io_handler.h"
using namespace zmm;

TranscodeExternalHandler::TranscodeExternalHandler() : TranscodeHandler()
{
}

Ref<IOHandler> TranscodeExternalHandler::open(Ref<TranscodingProfile> profile, 
                                              String location, 
                                              int objectType, 
                                              struct File_Info *info)
{
    bool isURL = false;
//    bool is_srt = false;

    log_debug("start\n");
    char fifo_template[]="/tmp/mt_transcode_XXXXXX";

    if (profile == nil)
        throw _Exception(_("Transcoding of file ") + location +
                           "requested but no profile given");
    
    isURL = (IS_CDS_ITEM_INTERNAL_URL(objectType) ||
            IS_CDS_ITEM_EXTERNAL_URL(objectType));

    String mimeType = profile->getTargetMimeType();

    info->content_type = ixmlCloneDOMString(mimeType.c_str());
    info->file_length = -1;


    String fifo_name = tempName(fifo_template);
    String arguments;
    String temp;
    String command;
#define MAX_ARGS 255
    char *argv[MAX_ARGS];
    Ref<Array<StringBase> > arglist;
    int i;
    int apos = 0;
/*
    if (!profile->acceptURL())
    {
        String url = location;
        location = tempName(fifo_template);
        log_debug("creating reader fifo: %s\n", location.c_str());
        if (mkfifo(location.c_str(), O_RDWR) == -1)
        {
            log_error("Failed to create fifo for the remote content reading thread: %s\n", strerror(errno));
            throw _Exception(_("Could not create reader fifo!\n"));
        }

        chmod(location.c_str(), S_IWOTH | S_IWGRP | S_IWUSR | S_IRUSR);
        /// \todo launch a thread that will be reading the remote content and 
        // saving it to the fifo
    }
*/
    log_debug("creating fifo: %s\n", fifo_name.c_str());
    if (mkfifo(fifo_name.c_str(), O_RDWR) == -1) 
    {
        log_error("Failed to create fifo for the transcoding process!: %s\n", strerror(errno));
        throw _Exception(_("Could not create fifo!\n"));
    }

    chmod(fifo_name.c_str(), S_IWOTH | S_IWGRP | S_IWUSR | S_IRUSR);

    pid_t transcoding_process = fork();
    switch (transcoding_process)
    {
        case -1:
            throw _Exception(_("Fork failed when launching transcoding process!"));
        case 0:
            arglist = parseCommandLine(profile->getArguments(), location, fifo_name);
            command = profile->getCommand();
            argv[0] = command.c_str();
            apos = 0;

                for (i = 0; i < arglist->size(); i++)
                {
                    argv[++apos] = arglist->get(i)->data; 
                    if (apos >= MAX_ARGS-1)
                        break;
                }

            argv[++apos] = NULL;
            log_debug("Executing transcoder: %s\n", command.c_str());
#ifdef LOG_TOMBDEBUG
            i = 0;
            log_debug("Transcoder argument list: ");
            do
            {
                printf("%s ", argv[i]);
                i++;
            }
            while (argv[i] != NULL);
          
            printf("\n");
#endif
            sigset_t mask_set;
            pthread_sigmask(SIG_SETMASK, &mask_set, NULL);

            execvp(command.c_str(), argv);
        default:
            break;
    }
    log_debug("Launched transcoding process, pid: %d\n", transcoding_process);


    
    Ref<IOHandler> io_handler(new BufferedIOHandler(Ref<IOHandler> (new ProcessIOHandler(fifo_name, transcoding_process)), profile->getBufferSize(), profile->getBufferChunkSize(), profile->getBufferInitialFillSize()));

    io_handler->open(UPNP_READ);
    return io_handler;
}

#endif//TRANSCODING
