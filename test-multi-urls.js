// 测试多链接功能的脚本
async function testMultiUrls() {
  const API_URL = 'http://localhost:3001';
  
  // 假设你已经有一个有效的API密钥
  // 请替换为实际的API密钥
  const API_KEY = 'YOUR_API_KEY_HERE';
  
  console.log('测试多链接功能...\n');
  
  // 模拟多次请求，验证轮询效果
  console.log('发送5次请求到 /api/versions/latest，观察返回的链接是否会变化：\n');
  
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(`${API_URL}/api/versions/latest`, {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`请求 ${i + 1}: 返回的下载链接 - ${data.data.downloadUrl}`);
      } else {
        const error = await response.json();
        console.error(`请求 ${i + 1} 失败:`, error);
      }
    } catch (error) {
      console.error(`请求 ${i + 1} 错误:`, error.message);
    }
    
    // 添加小延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n测试完成！');
  console.log('如果上面的链接有变化，说明轮询功能正常工作。');
  console.log('请确保先创建一个包含多个下载链接的版本。');
}

// 运行测试
testMultiUrls().catch(console.error);