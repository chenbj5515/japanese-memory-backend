import { Hono } from 'hono';
import { openaiAuthMiddleware } from '../middleware/openai-auth';
import { openai as openaiClient } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import { checkSubscription } from '../utils/check-subscription';
import { prisma } from '../services/prisma';
import { action_type_enum, related_type_enum } from '@prisma/client';

const openai = new Hono();

// 使用 OpenAI 鉴权中间件
openai.use('/*', openaiAuthMiddleware);

// 字幕识别路由
openai.post('/extract-subtitles', async (c) => {
  // 从中间件注入的context中获取用户信息
  const user = c.get('user');
  
  // 如果没有订阅，检查今日使用次数
  if (!user.has_subscription) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayUsage = await prisma.user_action_logs.count({
      where: {
        user_id: user.user_id,
        action_type: action_type_enum.COMPLETE_IMAGE_OCR,
        create_time: {
          gte: today
        }
      }
    });

    if (todayUsage >= 20) {
      return c.json({ success: false, error: 'Daily OCR usage limit exceeded. Please upgrade your subscription for unlimited access.' }, 403);
    }
  }

  // 修改为处理 FormData 格式的请求
  const formData = await c.req.formData();
  const imageFile = formData.get('image') as File;

  if (!imageFile) {
    return c.json({ success: false, error: '未找到图片文件' }, 400);
  }

  // 将文件转换为 base64
  const arrayBuffer = await imageFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64Image = buffer.toString('base64');

  const openaiApiKey = OPENAI_API_KEY;
  if (!openaiApiKey) {
    return c.json({ success: false, error: '服务器未配置 OpenAI API Key' }, 400);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",  // 更正模型名称
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "请只识别并输出图片底部的日文字幕文本，不要输出其他内容。如果没有字幕，请返回空字符串。"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 100
      })
    });

    const data = await response.json();
    // 从响应中提取实际的字幕文本
    const subtitles = data.choices?.[0]?.message?.content || '';
    
    // 记录用户操作日志
    await prisma.user_action_logs.create({
      data: {
        user_id: user.user_id,
        action_type: action_type_enum.COMPLETE_IMAGE_OCR,
        related_id: user.user_id, // 由于OCR操作没有特定的关联ID，使用用户ID作为关联ID
        related_type: related_type_enum.word_card // 使用word_card作为关联类型，因为这是最接近的类型
      }
    });

    return c.json({ success: true, subtitles });
  } catch (err: any) {
    return c.json({ success: false, error: err?.message }, 500);
  }
});

// 流式响应路由
openai.get('/stream', async (c) => {
  try {
    if (!OPENAI_API_KEY) {
      return c.json({ success: false, error: '服务器未配置 OpenAI API Key' }, 400);
    }

    const prompt = c.req.query('prompt');
    const model = c.req.query('model') || 'gpt-4o';

    if (!prompt) {
      return c.json({ success: false, error: '缺少必要参数 prompt' }, 400);
    }

    // 使用 Vercel AI SDK 创建流式响应
    const result = streamText({
      model: openaiClient(model),
      messages: [{ role: 'user', content: prompt }],
    });

    // 设置响应头
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        for await (const delta of result.textStream) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    return c.newResponse(stream);
  } catch (err: any) {
    return c.json({ success: false, error: err?.message }, 500);
  }
});

// 完成路由
openai.post('/completion', async (c) => {
  try {
    if (!OPENAI_API_KEY) {
      return c.json({ success: false, error: '未配置 OpenAI API 密钥' }, 500);
    }

    console.log('getting body===');
    console.log('Content-Type:', c.req.header('Content-Type'));

    // 尝试获取请求体，添加超时处理
    let body;
    try {
      // 尝试这种方式解析请求体
      const contentType = c.req.header('Content-Type') || '';
      if (contentType.includes('application/json')) {
        body = await c.req.json();
      } else {
        const text = await c.req.text();
        console.log('请求体文本:', text.substring(0, 200)); // 只打印前200个字符
        body = JSON.parse(text);
      }
    } catch (e: any) {
      console.log('解析请求体错误:', e?.message);
      return c.json({ success: false, error: '无法解析请求体' }, 400);
    }

    console.log('body getted===', body);

    const { prompt, model = 'gpt-4o' } = body;

    if (!prompt) {
      return c.json({ success: false, error: '缺少必要的 prompt 参数' }, 400);
    }

    // 使用 ai-sdk 的 openaiClient 替代直接 fetch
    const result = await generateText({
      model: openaiClient(model),
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });

    return c.json({
      success: true,
      data: result.text
    });
  } catch (err: any) {
    console.error('处理请求时发生错误:', err);
    return c.json({
      success: false,
      error: err?.message || '处理请求时发生错误',
      stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
    }, 500);
  }
});

export default openai; 