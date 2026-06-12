FROM python:3.12-slim
WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com -r requirements.txt

COPY . .

CMD ["gunicorn", "-w", "2", "--preload", "-b", "0.0.0.0:5000", "app:app"]
