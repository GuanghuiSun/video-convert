const express = require('express');
const fs = require('fs');
const bodyParser = require('body-parser');
const {v4: uuidv4} = require('uuid');// 引入uuid库并选择v4版本
const path = require("path");
const {transformToVideo} = require("./dist/index");

const app = express();
const port = 3000;

// 使用bodyParser解析JSON格式的请求体
app.use(bodyParser.json({limit: '1000mb', extended: true}));

// 视频转换的API端点
app.post('/api/convert', async (req, res) => {
    try {
        // 从请求体获取数据
        // console.log(req.body.substring(0, 1000))
        if (req.body === undefined)
            return res.status(404).send('参数为空');
        const jsonStr = JSON.stringify(req.body)

        const uuid = uuidv4(undefined, undefined, undefined)
        const jsonFileName = uuid + '.json'
        const jsonFilePath = path.join(__dirname, 'jsons', jsonFileName);

        // 使用fs模块的writeFile方法将数据写入文件
        fs.writeFile(jsonFilePath, jsonStr, (err) => {
            if (err) {
                console.error(err);
                res.status(500).send('写入文件时出错');
            }
        });

        // console.log(jsonData)

        const videoFileName = uuid + '.mp4';
        const videoFilePath = path.join(__dirname, 'videos', videoFileName);


        transformToVideo({
            input: jsonFilePath,
            output: videoFilePath,
            rrwebPlayer: {}
        })
            .then((file) => {
                console.log(`Successfully transformed into "${file}".`);
                if (fs.existsSync(file)) {
                    // 使用sendFile发送视频流
                    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(file)}"`);
                    res.setHeader('Content-Type', 'video/mp4');
                    return res.sendFile(file);
                } else {
                    return res.status(404).send('文件未找到');
                }
            })
            .catch((error) => {
                console.log('Failed to transform this session.');
                console.error(error);
                process.exit(1);
            });

    } catch (error) {
        console.error(error);
        res.status(500).send('内部服务器错误');
    }
});

app.listen(port, () => {
    console.log(`视频转换服务运行在 http://localhost:${port}`);
});
