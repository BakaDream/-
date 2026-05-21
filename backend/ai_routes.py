import json
from urllib import error, request

from flask import Blueprint, jsonify, request as flask_request

from minimal_ai_chat import (
    AI_API_BASE_URL,
    AI_API_KEY,
    AI_MODEL,
    KNOWLEDGE_DIR,
    PERSONA_PATH,
    TEMPERATURE,
    build_knowledge_text,
    read_text_file,
)

ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")

ALLOWED_ROLES = {"user", "assistant"}
CONTEXT_FIELDS = [
    "routeName",
    "title",
    "category",
    "description",
    "currentActionLabel",
    "inputValue",
    "statusText",
    "resultText",
]


def clean_text(value):
    return value.strip() if isinstance(value, str) else ""


def normalize_messages(value):
    if not isinstance(value, list):
        return []

    messages = []
    for item in value[-40:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = clean_text(item.get("content"))
        if role in ALLOWED_ROLES and content:
            messages.append({"role": role, "content": content})
    return messages


def normalize_context(value):
    if not isinstance(value, dict):
        return {}

    context = {field: clean_text(value.get(field)) for field in CONTEXT_FIELDS}
    recent_traces = value.get("recentTraces")
    context["recentTraces"] = [
        clean_text(item) for item in recent_traces[-5:] if clean_text(item)
    ] if isinstance(recent_traces, list) else []
    return context


def build_context_text(context):
    if not context:
        return "当前页面上下文：未识别。"

    lines = [
        f"路由名称：{context.get('routeName') or '未知'}",
        f"页面标题：{context.get('title') or '未知'}",
        f"分类：{context.get('category') or '未知'}",
        f"页面说明：{context.get('description') or '暂无'}",
        f"当前操作：{context.get('currentActionLabel') or '未选择'}",
        f"输入框内容：{context.get('inputValue') or '暂无'}",
        f"状态文本：{context.get('statusText') or '暂无'}",
        f"结果文本：{context.get('resultText') or '暂无'}",
    ]
    traces = context.get("recentTraces") or []
    lines.append("最近执行日志：" + ("；".join(traces) if traces else "暂无"))
    return "\n".join(lines)


def build_system_prompt(context):
    persona = read_text_file(PERSONA_PATH)
    knowledge = build_knowledge_text()

    parts = []
    parts.append(
        "【助手人设】\n"
        + (
            persona
            or "你是一个简洁清楚的中文 AI 助手，擅长讲解数据结构与算法。"
        )
    )

    if knowledge:
        parts.append("【网站知识库】\n" + knowledge)

    parts.append("【当前页面上下文】\n" + build_context_text(context))
    parts.append(
        "【回复规则】\n"
        "1. 必须使用中文回答。\n"
        "2. 优先结合当前页面上下文回答，尤其是页面标题、当前操作、结果文本和最近执行日志。\n"
        "3. 先给结论，再给解释。\n"
        "4. 不知道时明确说不知道。\n"
        "5. 不要编造页面不存在的执行状态、输入、日志或结果。\n"
        "6. 不要使用 Markdown 格式，不要输出 **、#、```、`、表格、引用块等格式符号；用普通中文纯文本和短句换行表达。\n"
        "7. 如果知识库没有明确内容，可以结合通用数据结构知识补充，并说明是补充解释。"
    )
    return "\n\n".join(parts)


def call_chat_completions(messages):
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

    return clean_text(body["choices"][0]["message"]["content"])


@ai_bp.get("/health")
def ai_health():
    return jsonify(
        {
            "ok": True,
            "model": AI_MODEL,
            "persona": str(PERSONA_PATH),
            "knowledgeDir": str(KNOWLEDGE_DIR),
        }
    )


@ai_bp.post("/chat")
def ai_chat():
    body = flask_request.get_json(silent=True) or {}
    session_id = clean_text(body.get("sessionId"))
    messages = normalize_messages(body.get("messages"))
    context = normalize_context(body.get("context"))

    if not session_id:
        return jsonify({"error": "sessionId 不能为空"}), 400
    if not messages or messages[-1]["role"] != "user":
        return jsonify({"error": "messages 必须包含最后一条用户消息"}), 400

    chat_messages = [
        {"role": "system", "content": build_system_prompt(context)},
        *messages,
    ]

    try:
        reply = call_chat_completions(chat_messages)
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        return jsonify({"error": f"AI 中转站返回 HTTP {exc.code}", "detail": detail[:800]}), 502
    except Exception as exc:
        return jsonify({"error": f"AI 请求失败：{exc}"}), 502

    return jsonify({"reply": reply, "sessionId": session_id})
