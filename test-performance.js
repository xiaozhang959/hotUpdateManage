const https = require('https');
const http = require('http');

// 配置
const API_KEY = '这里填入您的API密钥'; // 需要替换为实际的API密钥
const BASE_URL = 'http://localhost:3000';
const TEST_ROUNDS = 100; // 测试请求次数
const CONCURRENT_REQUESTS = 10; // 并发请求数

// 发送单个请求并计时
async function sendRequest() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const data = JSON.stringify({ apiKey: API_KEY });
    
    const url = new URL(`${BASE_URL}/api/versions/latest`);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            success: res.statusCode === 200,
            duration,
            data: parsedData
          });
        } catch (error) {
          resolve({
            success: false,
            duration,
            error: 'Failed to parse response'
          });
        }
      });
    });
    
    req.on('error', (error) => {
      const endTime = Date.now();
      reject({
        success: false,
        duration: endTime - startTime,
        error: error.message
      });
    });
    
    req.write(data);
    req.end();
  });
}

// 运行并发测试
async function runConcurrentTest(concurrency, totalRequests) {
  console.log(`\\n开始性能测试...`);
  console.log(`总请求数: ${totalRequests}`);
  console.log(`并发数: ${concurrency}`);
  console.log('------------------------');
  
  const results = [];
  const batches = Math.ceil(totalRequests / concurrency);
  
  const startTime = Date.now();
  
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(concurrency, totalRequests - i * concurrency);
    const promises = [];
    
    for (let j = 0; j < batchSize; j++) {
      promises.push(sendRequest());
    }
    
    const batchResults = await Promise.allSettled(promises);
    results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason));
    
    // 显示进度
    const progress = Math.min((i + 1) * concurrency, totalRequests);
    process.stdout.write(`\\r进度: ${progress}/${totalRequests}`);
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log('\\n\\n测试结果:');
  console.log('------------------------');
  
  // 分析结果
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const durations = successResults.map(r => r.duration);
  
  if (durations.length > 0) {
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const medianDuration = durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)];
    
    // 计算95百分位
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Duration = durations.sort((a, b) => a - b)[p95Index];
    
    console.log(`成功请求: ${successResults.length}`);
    console.log(`失败请求: ${failedResults.length}`);
    console.log(`\\n响应时间统计 (ms):`);
    console.log(`  平均值: ${avgDuration.toFixed(2)}`);
    console.log(`  中位数: ${medianDuration}`);
    console.log(`  最小值: ${minDuration}`);
    console.log(`  最大值: ${maxDuration}`);
    console.log(`  P95: ${p95Duration}`);
    console.log(`\\n吞吐量: ${(totalRequests / (totalTime / 1000)).toFixed(2)} 请求/秒`);
    console.log(`总耗时: ${(totalTime / 1000).toFixed(2)} 秒`);
    
    // 显示响应时间分布
    console.log(`\\n响应时间分布:`);
    const buckets = {
      '0-50ms': 0,
      '50-100ms': 0,
      '100-200ms': 0,
      '200-500ms': 0,
      '500-1000ms': 0,
      '1000ms+': 0
    };
    
    durations.forEach(d => {
      if (d <= 50) buckets['0-50ms']++;
      else if (d <= 100) buckets['50-100ms']++;
      else if (d <= 200) buckets['100-200ms']++;
      else if (d <= 500) buckets['200-500ms']++;
      else if (d <= 1000) buckets['500-1000ms']++;
      else buckets['1000ms+']++;
    });
    
    Object.entries(buckets).forEach(([range, count]) => {
      const percentage = (count / durations.length * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(percentage / 2));
      console.log(`  ${range.padEnd(12)} ${count.toString().padStart(4)} (${percentage.padStart(5)}%) ${bar}`);
    });
  }
  
  if (failedResults.length > 0) {
    console.log(`\\n失败详情:`);
    const errorGroups = {};
    failedResults.forEach(r => {
      const error = r.error || 'Unknown error';
      errorGroups[error] = (errorGroups[error] || 0) + 1;
    });
    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`  ${error}: ${count}`);
    });
  }
}

// 获取缓存统计
async function getCacheStats() {
  return new Promise((resolve) => {
    const url = new URL(`${BASE_URL}/api/cache/stats`);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const stats = JSON.parse(data);
          resolve(stats);
        } catch (error) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

// 主函数
async function main() {
  if (API_KEY === '这里填入您的API密钥') {
    console.error('请先设置API_KEY变量！');
    process.exit(1);
  }
  
  console.log('性能优化测试工具');
  console.log('================\\n');
  
  // 预热（发送几个请求让缓存生效）
  console.log('预热中...');
  for (let i = 0; i < 5; i++) {
    await sendRequest().catch(() => {});
  }
  
  // 获取初始缓存统计
  const statsBefor
  = await getCacheStats();
  
  // 运行测试
  await runConcurrentTest(CONCURRENT_REQUESTS, TEST_ROUNDS);
  
  // 获取测试后的缓存统计
  const statsAfter = await getCacheStats();
  
  if (statsAfter && statsAfter.data) {
    console.log('\\n\\n缓存统计:');
    console.log('------------------------');
    const cacheData = statsAfter.data;
    
    if (cacheData.memoryCache) {
      console.log('内存缓存:');
      console.log(`  缓存键数量: ${cacheData.memoryCache.keys}`);
      console.log(`  命中次数: ${cacheData.memoryCache.hits}`);
      console.log(`  未命中次数: ${cacheData.memoryCache.misses}`);
      console.log(`  命中率: ${(cacheData.memoryCache.hitRate * 100).toFixed(2)}%`);
    }
    
    console.log(`\\n轮询索引缓存数: ${cacheData.rotationIndexes}`);
    console.log(`Redis连接: ${cacheData.redisConnected ? '已连接' : '未连接'}`);
  }
  
  console.log('\\n\\n优化建议:');
  console.log('------------------------');
  console.log('1. 如果平均响应时间 > 100ms，考虑：');
  console.log('   - 检查数据库查询性能');
  console.log('   - 增加缓存TTL时间');
  console.log('   - 使用Redis作为分布式缓存');
  console.log('\\n2. 如果缓存命中率 < 80%，考虑：');
  console.log('   - 增加缓存TTL时间');
  console.log('   - 预热常用数据');
  console.log('\\n3. 如果有失败请求，检查：');
  console.log('   - 服务器资源是否足够');
  console.log('   - 数据库连接池配置');
}

// 运行测试
main().catch(console.error);