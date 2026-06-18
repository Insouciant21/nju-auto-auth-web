# NJU Auto Login Helper

Chrome/Edge Manifest V3 扩展，自动填充南大统一身份认证页的学号、密码和验证码。

## 功能

- 自动填充学号和密码
- 使用本地 AI 模型自动识别验证码（所有推理在浏览器本地完成）
- 点击扩展图标弹出面板，可直接输入/修改账号信息
- 仅在 `https://authserver.nju.edu.cn/authserver/login*` 生效

## 安装

1. `npm run build`
2. 打开 `chrome://extensions/`，启用开发者模式
3. 选择"加载已解压的扩展程序"，选中本目录
4. 点击扩展图标，填写学号和密码，保存

## 致谢

- 验证码识别模型来自 [Do1e/NJUlogin](https://github.com/Do1e/NJUlogin)（MIT License）
- ONNX 运行时使用 [onnxruntime-web](https://github.com/Microsoft/onnxruntime)（MIT License）
