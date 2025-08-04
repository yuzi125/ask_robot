from typing import Iterable, Iterator, TypeVar

T = TypeVar("T")


def split_chunk(l: Iterable[T], n=500) -> Iterator[list[T]]:
    if isinstance(l, list):
        for i in range(0, len(l), n):
            yield l[i:i + n]
    else:
        buf: list[T] = []
        for i in l:
            buf.append(i)
            if len(buf) >= n:
                yield buf
                buf = []
        if len(buf) > 0:
            yield buf
