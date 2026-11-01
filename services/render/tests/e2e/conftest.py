"""The e2e suite talks to a live service (SERVICE_URL) and is run as a script:

    python tests/e2e/test_full_suite.py

Keep pytest from collecting it, or every plain `pytest` run fails with connection errors.
"""

collect_ignore = ["test_full_suite.py"]
