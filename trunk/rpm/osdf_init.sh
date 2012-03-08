#!/bin/sh -e

### BEGIN INIT INFO
# Provides:          osdf
# Required-Stop:     $local_fs $remote_fs
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: osdf script
# Description:       Open Science Data Framework (OSF) daemon
### END INIT INFO

SCRIPT_OK=0
SCRIPT_ERROR=1

OSDF_USER=osdf
ENVIRONMENT=production

DESCRIPTION="osdf daemon"
NAME=OSDF
SCRIPT_NAME=`basename $0`
OSDF_HOME=/usr/lib/osdf
RUN_DIR=/var/run/$NAME
PIDFILE=/var/run/$NAME/$NAME.pid
LSB_LIBRARY=/lib/lsb/init-functions
LOG=/var/log/osdf/osdf.log


export NODE_ENV=$ENVIRONMENT
# For node.js version >= 0.6
export NODE_PATH=$OSDF_HOME:$OSDF_HOME/lib

if test ! -d "$OSDF_HOME"; then
    exit $SCRIPT_ERROR
fi

log_daemon_msg () {
    # Dummy function to be replaced by LSB library.
    echo $@
}

log_end_msg () {
    # Dummy function to be replaced by LSB library.
    if test "$1" != "0"; then
      echo "Error with $DESCRIPTION: $NAME"
    fi
    return $1
}

if test -r $LSB_LIBRARY; then
    . $LSB_LIBRARY
fi

start_osdf () {
    # Start OSDF as a background process.
    if [ ! -f "$RUN_DIR" ]; then
        mkdir -p "$RUN_DIR" && chown $OSDF_USER "$RUN_DIR"
    fi
    pushd "$OSDF_HOME" >/dev/null 2>&1
    start_daemon -p $PIDFILE "/usr/bin/node osdf.js >> $LOG &"
    local START_RV=$?
    if [ "$START_RV" == "0" ]; then
	sleep 3
        PID=`ps aux | grep node | grep $OSDF_USER | grep -v grep | awk '{print $2}'`
        echo $PID > $PIDFILE
        return $SCRIPT_OK
    else
        return $SCRIPT_ERROR
    fi
}

stop_osdf () {
    killproc -p $PIDFILE
    KILL_RV=$?
    return $SCRIPT_OK
    if [ "$KILL_RV" == "0" ]; then
        return $SCRIPT_OK
    else
        return $SCRIPT_ERROR
    fi
}

display_status () {
    if [ -f $PIDFILE ]; then
	PID=`cat $PIDFILE`
        echo "$NAME running with PID $PID"
    else
        echo "$NAME not running."
    fi
}

parse_script_option_list () {
    # Parse arguments passed to the script and take appropriate action.

    case "$1" in
        start)
            log_daemon_msg "Starting $DESCRIPTION"
            if start_osdf; then
                log_end_msg $SCRIPT_OK
            else
                log_end_msg $SCRIPT_ERROR
            fi
            ;;
        stop)
            log_daemon_msg "Stopping $DESCRIPTION"
            if stop_osdf; then
                log_end_msg $SCRIPT_OK
            else
                log_end_msg $SCRIPT_ERROR
            fi
            ;;
        restart)
            log_daemon_msg "Restarting $DESCRIPTION"
            if stop_osdf; then
                if start_osdf; then
                    log_end_msg $SCRIPT_OK
                else
                    log_end_msg $SCRIPT_ERROR
                fi
            else
                log_end_msg $SCRIPT_ERROR
            fi
            ;;
        status)
            display_status
            ;;
        *)
            cat << EOF >&2
Usage: $SCRIPT_NAME {start|stop|restart|status}
EOF
            exit $SCRIPT_ERROR
            ;;
    esac
}

parse_script_option_list $@
