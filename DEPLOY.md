# 好友大富翁 · 联网版部署

## 方案 A：Render 一键部署（推荐）

1. 把本项目推到 GitHub 公开仓库
2. 访问 https://render.com/deploy，用 GitHub 登录
3. 选择你的 friends-monopoly 仓库
4. Render 会自动识别 Node 项目，使用以下设置：
   - Build Command：`npm install`
   - Start Command：`npm start`
5. 点 Create Web Service，等待部署完成
6. 部署完成后获得公网地址，如 `https://friends-monopoly.onrender.com`

## 方案 B：本地运行

```bash
npm install
npm start
```

访问 http://localhost:8000

## 玩法

1. 手机/电脑打开公网地址
2. 输入昵称 → 创建房间
3. 把房间号发给朋友
4. 朋友用同一地址加入
5. 房主点开始游戏
