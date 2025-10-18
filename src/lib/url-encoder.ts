/**
 * 对URL中的中文和特殊字符进行编码
 * 保留URL结构（协议、域名、路径分隔符等）
 */
export function encodeDownloadUrl(url: string): string {
  try {
    // 如果URL为空，直接返回
    if (!url || url.trim() === '') {
      return url;
    }

    // 解析URL
    const urlObj = new URL(url);
    
    // 对路径进行编码，保留斜杠
    const pathParts = urlObj.pathname.split('/');
    const encodedPathParts = pathParts.map(part => {
      // 对每个路径段进行编码
      // 只编码非ASCII字符，保留常见的文件名字符
      return part.split('').map(char => {
        // 如果是ASCII字符且是安全字符，保持原样
        if (/^[a-zA-Z0-9._\-~]$/.test(char)) {
          return char;
        }
        // 否则进行URL编码
        return encodeURIComponent(char);
      }).join('');
    });
    
    // 重建URL
    urlObj.pathname = encodedPathParts.join('/');
    
    return urlObj.toString();
  } catch (e) {
    // 如果不是有效的URL，尝试简单编码
    // 这种情况可能是相对路径
    if (url.startsWith('/')) {
      // 相对路径
      const pathParts = url.split('/');
      const encodedParts = pathParts.map(part => {
        return part.split('').map(char => {
          if (/^[a-zA-Z0-9._\-~]$/.test(char)) {
            return char;
          }
          return encodeURIComponent(char);
        }).join('');
      });
      return encodedParts.join('/');
    }
    
    // 如果既不是完整URL也不是路径，返回原值
    console.warn('Invalid URL for encoding:', url);
    return url;
  }
}

/**
 * 对多个下载链接进行URL编码
 */
export function encodeDownloadUrls(urls: string[]): string[] {
  return urls.map(url => encodeDownloadUrl(url));
}