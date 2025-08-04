import gevent.monkey

gevent.monkey.patch_all()


def post_worker_init(worker):
    import gevent.monkey
    from psycopg2 import extensions
    gevent.monkey.patch_all()
    extensions.set_wait_callback(gevent_wait_callback)


def gevent_wait_callback(conn, timeout=None):
    from gevent.socket import wait_read, wait_write
    from psycopg2 import OperationalError, extensions
    """A wait callback useful to allow gevent to work with Psycopg."""
    while 1:
        state = conn.poll()
        if state == extensions.POLL_OK:
            break
        elif state == extensions.POLL_READ:
            wait_read(conn.fileno(), timeout=timeout)
        elif state == extensions.POLL_WRITE:
            wait_write(conn.fileno(), timeout=timeout)
        else:
            raise OperationalError("Bad result from poll: %r" % state)


workers = 4
worker_class = 'gevent'
