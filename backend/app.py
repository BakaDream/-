import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify
# 导入 BST 蓝图
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
from app_config import get_public_config

app = Flask(__name__)


@app.get("/api/config")
def app_public_config():
    return jsonify(get_public_config())

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


# 使用 flask run 启动:
#   cd backend && flask run --host=127.0.0.1 --port=5000
# 或使用 gunicorn:
#   cd backend && gunicorn -w 2 --preload -b 127.0.0.1:5000 app:app
