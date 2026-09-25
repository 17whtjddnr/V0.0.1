import pytest

from agent import Agent


def test_agent_handles_empty_prompt():
    agent = Agent()
    result = agent.respond("")
    assert "Please provide" in result


def test_agent_formats_response():
    agent = Agent()
    result = agent.respond("Write a short greeting")
    assert isinstance(result, str)
    assert len(result) > 0
