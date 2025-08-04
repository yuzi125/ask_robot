from typing import Literal

def error_msg(msg, br=True):
    tag = 'p' if br else 'span'
    br_class: Literal[''] | Literal['br'] = '' if not br else 'br'
    return f"<{tag} class='error {br_class}'>{msg}</{tag}>"

def info_msg(msg, br=True):
    tag = 'p' if br else 'span'
    br_class: Literal[''] | Literal['br'] = '' if not br else 'br'
    return f"<{tag} class='info {br_class}'>{msg}</{tag}>"

def warn_msg(msg, br=True):
    tag = 'p' if br else 'span'
    br_class: Literal[''] | Literal['br'] = '' if not br else 'br'
    return f"<{tag} class='warning {br_class}'>{msg}</{tag}>"

def success_msg(msg, br=True):
    tag = 'p' if br else 'span'
    br_class: Literal[''] | Literal['br'] = '' if not br else 'br'
    return f"<{tag} class='success {br_class}'>{msg}</{tag}>"
