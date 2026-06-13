import json
import os
from pathlib import Path
from urllib import error, request

from app_config import is_ai_enabled

AI_API_BASE_URL = os.environ.get("AI_API_BASE_URL", "https://api.sbbbbbbbbb.xyz/v1")
AI_API_KEY = os.environ.get("AI_API_KEY", "sk-oGCxua7Ne7B9smHOnYAhujtLIWIVxbn4fs64VtxccoQxAEHw")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-5.4")
TEMPERATURE = float(os.environ.get("AI_TEMPERATURE", "0.7"))
MAX_KNOWLEDGE_CHARS = 12000

BASE_DIR = Path(__file__).resolve().parent
PERSONA_PATH = BASE_DIR / "prompts" / "assistant_persona.md"
KNOWLEDGE_DIR = BASE_DIR / "knowledge"
HISTORY_PATH = BASE_DIR / "chat_history.json"

EXIT_COMMANDS = {"退出", "exit", "quit", "/exit"}
RESET_COMMANDS = {"/reset", "/clear"}


def read_text_file(path):
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8").strip()


def build_knowledge_text():
    if not KNOWLEDGE_DIR.exists():
        return ""

    chunks = []
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        content = read_text_file(path)
        if content:
            chunks.append(f"# 文件：{path.name}\n{content}")

    merged = "\n\n".join(chunks).strip()
    return merged[:MAX_KNOWLEDGE_CHARS]


def build_system_prompt():
    persona = read_text_file(PERSONA_PATH)
    knowledge = build_knowledge_text()

    parts = []
    if persona:
        parts.append("【助手人设】\n" + persona)
    else:
        parts.append(
            "【助手人设】\n"
            "你是一个简洁清楚的中文 AI 助手，擅长讲解数据结构与算法。"
            "回答时先给结论，再给解释，不要编造不知道的内容。"
        )

    if knowledge:
        parts.append("【知识库】\n" + knowledge)

    parts.append(
        "【回复规则】\n"
        "1. 使用中文回答。\n"
        "2. 优先依据知识库回答。\n"
        "3. 如果知识库没有明确内容，可以结合通用常识补充，但要说明是补充解释。\n"
        "4. 讲解尽量简洁、清楚、分点。"
    )

    return "\n\n".join(parts)


def load_history():
    if not HISTORY_PATH.exists():
        return []

    try:
        data = json.loads(HISTORY_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []

    if not isinstance(data, list):
        return []

    messages = []
    for item in data:
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"} and isinstance(item.get("content"), str):
            messages.append({"role": item["role"], "content": item["content"]})
    return messages


def save_history(messages):
    serializable = [item for item in messages if item.get("role") in {"user", "assistant"}]
    HISTORY_PATH.write_text(json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8")


def build_messages(history_messages):
    return [{"role": "system", "content": build_system_prompt()}, *history_messages]


def send_chat(messages):
    if not is_ai_enabled():
        raise RuntimeError("AI 功能已关闭")

    payload = {
        "model": AI_MODEL,
        "messages": messages,
        "temperature": TEMPERATURE,
    }

    req = request.Request(
        url=f"{AI_API_BASE_URL.rstrip('/')}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AI_API_KEY}",
        },
        method="POST",
    )

    with request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read().decode("utf-8"))

    return body["choices"][0]["message"]["content"]


def print_intro(history_messages):
    print("=== AI 持续对话脚本 ===")
    print(f"模型: {AI_MODEL}")
    print(f"人设文档: {PERSONA_PATH}")
    print(f"知识库目录: {KNOWLEDGE_DIR}")
    print(f"历史记录: {HISTORY_PATH}")
    print("输入内容后回车发送。输入 退出 / exit 结束。输入 /reset 清空历史重开。")
    if history_messages:
        print(f"已加载 {len(history_messages)} 条历史消息，继续接着聊。")


def main():
    if not is_ai_enabled():
        print("AI 功能已关闭。请设置 ENABLE_AI=true 后再使用。")
        input("\n回车退出...")
        return

    if not AI_API_BASE_URL or not AI_API_KEY or not AI_MODEL:
        print("Base URL / API Key / 模型名不能为空。")
        input("\n回车退出...")
        return

    history_messages = load_history()
    print_intro(history_messages)

    while True:
        user_message = input("\n你: ").strip()

        if not user_message:
            continue

        if user_message in EXIT_COMMANDS:
            save_history(history_messages)
            print("聊天记录已保存，老子先撤。")
            input("\n回车退出...")
            return

        if user_message in RESET_COMMANDS:
            history_messages = []
            save_history(history_messages)
            print("历史记录已清空，重新开聊。")
            continue

        history_messages.append({"role": "user", "content": user_message})
        messages = build_messages(history_messages)

        try:
            answer = send_chat(messages)
        except error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="ignore")
            print(f"\nHTTP {exc.code}")
            print(err_body)
            history_messages.pop()
            continue
        except Exception as exc:
            print(f"\n请求失败：{exc}")
            history_messages.pop()
            continue

        history_messages.append({"role": "assistant", "content": answer})
        save_history(history_messages)

        print("\nAI:")
        print(answer)


if __name__ == "__main__":
    main()
