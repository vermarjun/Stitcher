from __future__ import annotations

from app.core.classify import classify


def test_name_error_extracts_line_and_summary() -> None:
    stderr = '''
Traceback (most recent call last):
  File "/work/animation.py", line 7, in construct
    self.play(Writ(Text("hi")))
NameError: name 'Writ' is not defined
'''
    r = classify(stderr)
    assert r.category == "NameError"
    assert r.line == 7
    assert "Writ" in r.summary


def test_type_error_captured() -> None:
    stderr = '''
  File "/work/animation.py", line 3, in construct
TypeError: Circle() got unexpected keyword argument 'radiuss'
'''
    r = classify(stderr)
    assert r.category == "TypeError"
    assert "radiuss" in r.summary
    assert r.line == 3


def test_latex_error_detected() -> None:
    stderr = "LaTeX compilation failed: ! LaTeX Error: File `foo.sty' not found."
    r = classify(stderr)
    assert r.category == "LaTeXError"


def test_unknown_falls_back_to_stderr_tail() -> None:
    r = classify("some noise\nmanim: broken in a new way\n")
    assert r.category == "Unknown"
    assert "broken" in r.summary
