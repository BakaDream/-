from flask import Blueprint, request, jsonify
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../core'))
from tracer import OperationTracer

graph_bp = Blueprint('graph', __name__)


def build_adj_matrix(vertices, edges, directed=False):
    """Build adjacency matrix from vertices list and edges list."""
    n = len(vertices)
    idx = {v: i for i, v in enumerate(vertices)}
    mat = [[0] * n for _ in range(n)]
    for u, v in edges:
        if u in idx and v in idx:
            mat[idx[u]][idx[v]] = 1
            if not directed:
                mat[idx[v]][idx[u]] = 1
    return mat


def edges_to_graph_json(vertices, edges):
    """Convert vertices + edges to D3-friendly JSON."""
    return {
        "vertices": vertices,
        "edges": [{"source": u, "target": v} for u, v in edges]
    }


# ─────────────────────────────────────────────────────
# 1. Graph → Adjacency Matrix
# ─────────────────────────────────────────────────────
@graph_bp.route('/api/graph/to-matrix', methods=['POST'])
def to_matrix():
    data = request.get_json()
    vertices = data.get('vertices', [])
    edges = [tuple(e) for e in data.get('edges', [])]

    tracer = OperationTracer()
    mat = build_adj_matrix(vertices, edges)

    tracer.add_trace('init', {'vertices': vertices, 'edges': edges, 'matrix': None}, 1,
                     '初始化图结构，准备生成邻接矩阵...')

    for i, v in enumerate(vertices):
        row_edges = [(vertices[i], vertices[j]) for j in range(len(vertices)) if mat[i][j] == 1]
        tracer.add_trace('process_row', {'vertices': vertices, 'edges': edges, 'matrix': mat,
                                          'highlight_row': i},
                         3, f'处理顶点 {v}：检查与其他顶点的连接关系')

    tracer.add_trace('done', {'vertices': vertices, 'edges': edges, 'matrix': mat}, 5,
                     f'邻接矩阵生成完成！共 {len(vertices)} 个顶点，{len(edges)} 条边')

    return jsonify({'code': 200, 'traces': tracer.traces})


# ─────────────────────────────────────────────────────
# 2. Adjacency Matrix → Graph
# ─────────────────────────────────────────────────────
@graph_bp.route('/api/graph/from-matrix', methods=['POST'])
def from_matrix():
    data = request.get_json()
    vertices = data.get('vertices', [])
    matrix = data.get('matrix', [])

    tracer = OperationTracer()
    tracer.add_trace('init', {'vertices': vertices, 'edges': [], 'matrix': matrix}, 1,
                     '读取邻接矩阵，开始解析图结构...')

    edges = []
    for i in range(len(matrix)):
        for j in range(len(matrix[i])):
            if matrix[i][j] == 1 and i <= j:
                edges.append((vertices[i], vertices[j]))
                tracer.add_trace('found_edge', {'vertices': vertices, 'edges': list(edges), 'matrix': matrix,
                                                  'highlight_edge': [vertices[i], vertices[j]]},
                                 3, f'发现边：{vertices[i]} — {vertices[j]}（矩阵位置 [{i}][{j}]=1）')

    tracer.add_trace('done', {'vertices': vertices, 'edges': edges, 'matrix': matrix}, 5,
                     f'图构建完成！共 {len(vertices)} 个顶点，{len(edges)} 条边')

    return jsonify({'code': 200, 'traces': tracer.traces, 'edges': edges})


# ─────────────────────────────────────────────────────
# 3. Modify Matrix Element → Update Graph
# ─────────────────────────────────────────────────────
@graph_bp.route('/api/graph/update-matrix', methods=['POST'])
def update_matrix():
    data = request.get_json()
    vertices = data.get('vertices', [])
    matrix = [list(row) for row in data.get('matrix', [])]
    row = data.get('row', 0)
    col = data.get('col', 0)
    value = data.get('value', 0)

    tracer = OperationTracer()
    old_val = matrix[row][col]
    tracer.add_trace('init', {'vertices': vertices, 'matrix': matrix,
                               'edges': _matrix_to_edges(vertices, matrix)},
                     1, f'准备修改矩阵元素 [{row}][{col}]，当前值为 {old_val}')

    # Symmetric update for undirected graph
    matrix[row][col] = value
    matrix[col][row] = value

    tracer.add_trace('update', {'vertices': vertices, 'matrix': matrix,
                                 'edges': _matrix_to_edges(vertices, matrix),
                                 'highlight_cells': [[row, col], [col, row]]},
                     3, f'矩阵元素 [{row}][{col}] 已更新：{old_val} → {value}（无向图同步更新 [{col}][{row}]）')

    edges = _matrix_to_edges(vertices, matrix)
    tracer.add_trace('done', {'vertices': vertices, 'matrix': matrix, 'edges': edges}, 5,
                     f'图已根据矩阵变化动态更新，当前共 {len(edges)} 条边')

    return jsonify({'code': 200, 'traces': tracer.traces, 'matrix': matrix})


def _matrix_to_edges(vertices, matrix):
    edges = []
    for i in range(len(matrix)):
        for j in range(i, len(matrix[i])):
            if matrix[i][j] == 1:
                edges.append([vertices[i], vertices[j]])
    return edges


# ─────────────────────────────────────────────────────
# 4. Vertex Degree Calculation
# ─────────────────────────────────────────────────────
@graph_bp.route('/api/graph/degree', methods=['POST'])
def degree():
    data = request.get_json()
    vertices = data.get('vertices', [])
    edges = [list(e) for e in data.get('edges', [])]

    tracer = OperationTracer()
    tracer.add_trace('init', {'vertices': vertices, 'edges': edges, 'degrees': {}}, 1,
                     '开始计算各顶点的度数...')

    degrees = {v: 0 for v in vertices}
    for u, v in edges:
        if u in degrees:
            degrees[u] += 1
        if v in degrees:
            degrees[v] += 1

        tracer.add_trace('count_edge', {'vertices': vertices, 'edges': edges, 'degrees': dict(degrees),
                                         'highlight_edge': [u, v]},
                         3, f'处理边 {u}—{v}：顶点 {u} 度数+1={degrees[u]}，顶点 {v} 度数+1={degrees[v]}')

    tracer.add_trace('done', {'vertices': vertices, 'edges': edges, 'degrees': degrees}, 5,
                     '度数计算完成！' + '  '.join([f'{v}:{d}' for v, d in degrees.items()]))

    return jsonify({'code': 200, 'traces': tracer.traces, 'degrees': degrees})


# ─────────────────────────────────────────────────────
# 5. Simple Path Finding (DFS)
# ─────────────────────────────────────────────────────
@graph_bp.route('/api/graph/path', methods=['POST'])
def path():
    data = request.get_json()
    vertices = data.get('vertices', [])
    edges = [list(e) for e in data.get('edges', [])]
    source = data.get('source', '')
    target = data.get('target', '')

    tracer = OperationTracer()

    # Build adjacency list
    adj = {v: [] for v in vertices}
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)

    tracer.add_trace('init', {'vertices': vertices, 'edges': edges, 'path': [], 'visited': []},
                     1, f'开始查找从 {source} 到 {target} 的简单路径（DFS）...')

    found_path = []
    visited_log = []

    def dfs(node, target, path, visited):
        visited.add(node)
        path.append(node)
        visited_log.append(node)

        tracer.add_trace('visit', {'vertices': vertices, 'edges': edges,
                                    'path': list(path), 'visited': list(visited),
                                    'highlight_node': node},
                         3, f'DFS 访问顶点 {node}，当前路径：{" → ".join(path)}')

        if node == target:
            return True
        for neighbor in adj.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor, target, path, visited):
                    return True
        path.pop()
        tracer.add_trace('backtrack', {'vertices': vertices, 'edges': edges,
                                        'path': list(path), 'visited': list(visited),
                                        'highlight_node': node},
                         4, f'回溯：{node} 无法到达 {target}，退出该分支')
        return False

    path_result = []
    if source in adj and target in adj:
        p = []
        found = dfs(source, target, p, set())
        path_result = p if found else []

    if path_result:
        tracer.add_trace('found', {'vertices': vertices, 'edges': edges,
                                    'path': path_result, 'visited': visited_log},
                         6, f'✅ 找到路径：{" → ".join(path_result)}，共 {len(path_result)} 个顶点')
    else:
        tracer.add_trace('not_found', {'vertices': vertices, 'edges': edges,
                                        'path': [], 'visited': visited_log},
                         6, f'❌ 未找到从 {source} 到 {target} 的路径')

    return jsonify({'code': 200, 'traces': tracer.traces, 'path': path_result})
