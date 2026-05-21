import json, copy

class OperationTracer:
    def __init__(self):
        self.traces = []
        self.step_counter = 0

    def add_trace(self, action_type, data, line, msg):
        self.step_counter += 1
        self.traces.append({
            "step": self.step_counter,
            "type": action_type,
            "data": copy.deepcopy(data),
            "line": line,
            "message": msg
        })

    def get_json(self):
        return json.dumps(self.traces, indent=2, ensure_ascii=False)