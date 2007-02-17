/*MT*
    
    MediaTomb - http://www.mediatomb.cc/
    
    destroyer.cc - this file is part of MediaTomb.
    
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
    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
    
    $Id$
*/

/// \file destroyer.cc

#ifdef HAVE_CONFIG_H
    #include "autoconfig.h"
#endif

#include "destroyer.h"

using namespace zmm;

Destroyer::Destroyer(void (* destroy_func)(void *), void *data) : Object()
{
    this->destroy_func = destroy_func;
    this->data = data;
}
Destroyer::~Destroyer()
{
    destroy();
}
void Destroyer::destroy()
{
    if (destroy_func)
    {
        destroy_func(data);
        destroy_func = NULL;
    }
}
