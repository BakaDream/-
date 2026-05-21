import sys
import os
from pathlib import Path

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
# 【新增】导入刚才写的 BST 蓝图
from algorithms.tree.bst import tree_bp
from algorithms.tree.binary_tree import binary_tree_bp
from algorithms.tree.avl import avl_bp
from algorithms.tree.huffman import huffman_bp
from algorithms.tree.heap import heap_bp
# 【新增】导入链表蓝图
from algorithms.linear.linked_list import linear_bp
# 【新增】导入图结构蓝图
from algorithms.graph.graph import graph_bp
from algorithms.linear.linear_basic import linear_basic_bp
from algorithms.linear.linear_sort import linear_sort_bp
from algorithms.linear.linear_search import linear_search_bp
# 【新增】导入栈和队列蓝图
from algorithms.linear.stack import stack_bp
from algorithms.linear.queue import queue_bp
from ai_routes import ai_bp

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"

app = Flask(
    __name__,
    static_folder=str(FRONTEND_DIST_DIR / "assets") if FRONTEND_DIST_DIR.exists() else None,
    static_url_path="/assets",
)
CORS(app)

# 注册所有蓝图
app.register_blueprint(tree_bp)
app.register_blueprint(binary_tree_bp)
app.register_blueprint(avl_bp)
app.register_blueprint(huffman_bp)
app.register_blueprint(heap_bp)
app.register_blueprint(linear_bp)
app.register_blueprint(graph_bp)
app.register_blueprint(linear_basic_bp)
app.register_blueprint(linear_sort_bp)
app.register_blueprint(linear_search_bp)
app.register_blueprint(stack_bp)
app.register_blueprint(queue_bp)
app.register_blueprint(ai_bp)

@app.route('/')
def home():
    if FRONTEND_DIST_DIR.exists():
        return send_from_directory(FRONTEND_DIST_DIR, "index.html")
    return "✅ 后端框架运行正常！前端静态资源未构建。"


@app.route('/favicon.ico')
def favicon():
    if FRONTEND_DIST_DIR.exists():
        return send_from_directory(FRONTEND_DIST_DIR, "favicon.ico")
    return ("", 204)


@app.route('/<path:path>')
def spa_assets(path):
    if not FRONTEND_DIST_DIR.exists():
        return ("前端静态资源未构建。", 404)

    target = FRONTEND_DIST_DIR / path
    if target.exists() and target.is_file():
        return send_from_directory(FRONTEND_DIST_DIR, path)

    return send_from_directory(FRONTEND_DIST_DIR, "index.html")

if __name__ == '__main__':
    print("🚀 服务启动成功: http://localhost:5000")
    app.run(debug=False, host="127.0.0.1", port=5000)
