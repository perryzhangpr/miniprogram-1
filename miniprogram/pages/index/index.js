// pages/index/index.js

function pickCoverUrl(data) {
  const v = data?.video || {};
  const origin = v?.origin_cover?.url_list?.[0];
  const cover = v?.cover?.url_list?.[0];
  const dyn = v?.dynamic_cover?.url_list?.[0];
  return origin || cover || dyn || '';
}

Page({
  data: {
    navH: 0,
    safeB: 0,
    cloudDomain: 'https://douyin-api-210719-7-1392959478.sh.run.tcloudbase.com',

    inputUrl: '',
    result: null,
    isImageMode: false,
    isLoading: false,

    meta: {
      title: '',
      desc: '',
      coverUrl: '',
      videoUrl: '',
      shareUrl: '',
      // 👇 新增字段，注意前面的逗号
      author: { name: '', avatar: '' },
      music: { title: '', url: '', author: '', cover: '' },
      stats: { digg: 0, comment: 0, collect: 0, share: 0 },
      tags: []
    }
  },

  config: {
    envId: 'prod-9gvulm8k9ad81470',
    serviceName: 'douyin-api',
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    // 计算底部安全区 (手动减去15px调整视觉)
    let safeB = sys.safeArea ? (sys.screenHeight - sys.safeArea.bottom) : 0;
    if (safeB > 0) {
      safeB = safeB - 15;
      if (safeB < 0) safeB = 0;
    }

    const navH = (sys.statusBarHeight || 0) + 44;

    this.setData({
      navH: navH,
      safeB: safeB
    });

    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

  },

  onInput(e) {
    this.setData({ inputUrl: e.detail.value });
  },

  clearInput() {
    this.setData({
      inputUrl: '',
      result: null,
      meta: {
        title: '', desc: '', coverUrl: '', videoUrl: '', shareUrl: '',
        author: { name: '', avatar: '' },
        music: { title: '', url: '', author: '', cover: '' },
        stats: { digg: 0, comment: 0, collect: 0, share: 0 },
        tags: []
      }
    });
  },

  onlyPaste() {
    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ inputUrl: res.data });
          wx.showToast({ title: '已粘贴', icon: 'none' });
        } else {
          wx.showToast({ title: '剪切板为空', icon: 'none' });
        }
      }
    });
  },

  startParse() {
    if (this.data.inputUrl) return this.executeParse();

    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ inputUrl: res.data });
          wx.showLoading({ title: '识别链接中...' });
          setTimeout(() => this.executeParse(), 500);
        } else {
          wx.showToast({ title: '请输入或复制链接', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '请手动粘贴链接', icon: 'none' })
    });
  },

  executeParse() {
    const rawText = this.data.inputUrl;
    const urlMatch = rawText.match(/(https?:\/\/[^\s]+)/);
    if (!urlMatch) {
      wx.showToast({ title: '未检测到有效链接', icon: 'none' });
      return;
    }
    const cleanUrl = urlMatch[0];

    this.setData({
      isLoading: true,
      result: null,
      meta: { ...this.data.meta, shareUrl: cleanUrl }
    });

    if (cleanUrl.includes('bilibili.com') || cleanUrl.includes('b23.tv')) {
      wx.showLoading({ title: 'B站解析中...' });
      this.handleBilibiliParse(cleanUrl); // 走 B 站专用通道
      return; // 结束，不执行下面的代码
    }

    wx.showLoading({ title: '云端解析中...' });

    wx.cloud.callContainer({
      config: { env: this.config.envId },
      path: `/api/hybrid/video_data?url=${encodeURIComponent(cleanUrl)}&minimal=false`,
      header: {
        'X-WX-SERVICE': this.config.serviceName,
        'content-type': 'application/json'
      },
      method: 'GET',
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode !== 200) {
          // 单独处理 400 错误（可能是链接无效或视频过大）
          if (res.statusCode === 400) {
            const errMsg = res.data?.msg || '链接错误或不支持';
            wx.showToast({ title: errMsg, icon: 'none', duration: 3000 });
          } else {
            wx.showToast({ title: '服务繁忙: ' + res.statusCode, icon: 'none' });
          }
          return;
        }

        const apiData = res.data;
        if (apiData.code === 200 && apiData.data) {
          this.handleSuccess(apiData.data);
        } else {
          wx.showToast({ title: '解析失败，请检查链接', icon: 'none' });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error(err);
        wx.showToast({ title: '网络请求超时', icon: 'none' });
      },
      complete: () => this.setData({ isLoading: false })
    });
  },

  handleSuccess(data) {
    console.log('API全量数据:', data);

    // 1. 基础信息
    const desc = data?.desc || '';
    const title = data?.title || (desc ? (desc.length > 18 ? desc.slice(0, 18) + '…' : desc) : '视频标题');
    const coverUrl = pickCoverUrl(data);

    // 2. 提取作者信息
    const author = {
      name: data?.author?.nickname || '未知作者',
      avatar: data?.author?.avatar_thumb?.url_list?.[0] || '../../assets/icons/avatar.png'
    };

    // 3. 提取 BGM
    const musicData = data?.music || {};
    const music = {
      title: musicData.title || '原声',
      author: musicData.author || '未知歌手',
      url: musicData.play_url?.url_list?.[0] || musicData.play_url || '',
      cover: musicData.cover_thumb?.url_list?.[0] || ''
    };

    // 4. 提取统计数据
    const statData = data?.statistics || {};
    const stats = {
      digg: this.formatNum(statData.digg_count || 0),
      comment: this.formatNum(statData.comment_count || 0),
      collect: this.formatNum(statData.collect_count || 0),
      share: this.formatNum(statData.share_count || 0)
    };

    // 5. 提取标签
    const tags = (data?.hashtags || []).map(t => t.hashtag_name);

    // 6. 判断类型
    let type = 'video';
    let result = null;
    let isImageMode = false;

    if (data.images && data.images.length > 0) {
      type = 'image';
      isImageMode = true;
      result = data.images.map(item => item?.url_list?.[0] || '').filter(Boolean);
      wx.showToast({ title: `提取到 ${result.length} 张图片`, icon: 'success' });
    } else {
      type = 'video';
      isImageMode = false;
      result = data?.video?.play_addr?.url_list?.[0] || '';
      if (!result) { return wx.showToast({ title: '无法识别资源', icon: 'none' }); }
      wx.showToast({ title: '解析成功', icon: 'success' });
    }

    // 7. 更新数据
    this.setData({
      isImageMode,
      result,
      meta: {
        ...this.data.meta,
        title, desc, coverUrl,
        videoUrl: isImageMode ? '' : result,
        author, music, stats, tags
      }
    });

    // 8. 存入历史
    this.saveToHistory({
      id: new Date().getTime(),
      title, desc, coverUrl, type: isImageMode ? '图文' : '视频',
      shareUrl: this.data.meta.shareUrl,
      timeText: this.formatTime(new Date())
    });
  },

  // 格式化数字 (12000 -> 1.2w)
  formatNum(num) {
    if (!num) return '0';
    if (num > 10000) {
      return (num / 10000).toFixed(1) + 'w';
    }
    return num.toString();
  },

  downloadMusic() {
    const url = this.data.meta.music.url;
    if (!url) return wx.showToast({ title: '无音乐资源', icon: 'none' });

    // 既然 openDocument 不支持音频，我们直接提供最实用的两个选项
    wx.showActionSheet({
      itemList: ['在线播放', '复制链接 (去浏览器下载)'],
      success: (res) => {
        // 选项 1: 在线播放 (使用微信原生背景音频播放器，体验最好)
        if (res.tapIndex === 0) {
          const bgm = wx.getBackgroundAudioManager();
          bgm.title = this.data.meta.music.title || '背景音乐';
          bgm.epname = this.data.meta.author.name;
          bgm.coverImgUrl = this.data.meta.music.cover;
          bgm.src = url; // 设置 src 后会自动开始播放
          wx.showToast({ title: '开始播放', icon: 'none' });
        }
        // 选项 2: 复制链接
        else if (res.tapIndex === 1) {
          wx.setClipboardData({
            data: url,
            success: () => wx.showToast({ title: '链接已复制', icon: 'none' })
          });
        }
      }
    });
  },

  saveToHistory(item) {
    let history = wx.getStorageSync('historyList') || [];
    const index = history.findIndex(h => h.shareUrl === item.shareUrl);
    if (index > -1) {
      history.splice(index, 1);
    }
    history.unshift(item);
    if (history.length > 50) {
      history = history.slice(0, 50);
    }
    wx.setStorageSync('historyList', history);
  },

  formatTime(date) {
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${m}-${d} ${h}:${min}`;
  },

  copyDesc() {
    const text = this.data.meta?.desc || '';
    if (!text) return wx.showToast({ title: '没有可复制的文案', icon: 'none' });
    wx.setClipboardData({ data: text });
  },

  copyVideoLink() {
    const url = this.data.meta?.videoUrl || this.data.result || '';
    if (!url) return wx.showToast({ title: '没有可复制的视频链接', icon: 'none' });
    wx.setClipboardData({ data: url });
  },

  copyCoverLink() {
    const url = this.data.meta?.coverUrl || '';
    if (!url) return wx.showToast({ title: '没有封面链接', icon: 'none' });
    wx.setClipboardData({ data: url });
  },

  handleSaveCover() {
    const coverUrl = this.data.meta?.coverUrl;
    if (!coverUrl) return wx.showToast({ title: '没有封面可保存', icon: 'none' });

    wx.showLoading({ title: '下载封面中...' });
    wx.downloadFile({
      url: coverUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({ title: '封面已保存', icon: 'success' });
            },
            fail: (err) => {
              wx.hideLoading();
              this.checkAuth(err);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({ title: '封面下载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '封面下载失败', icon: 'none' });
      }
    });
  },

  handleSaveVideo() {
    if (!this.data.result) {
      wx.showToast({ title: '没有可保存的视频', icon: 'none' });
      return;
    }

    const videoUrl = this.data.result;
    wx.showLoading({ title: '视频下载中...' });

    // ✨✨✨ 核心判断：是云存储文件还是普通链接？ ✨✨✨
    if (videoUrl.startsWith('cloud://')) {
      // 🚀 方案 B：走云存储内网下载 (绕过域名限制)
      wx.cloud.downloadFile({
        fileID: videoUrl,
        success: (res) => {
          this.saveVideoToAlbum(res.tempFilePath);
        },
        fail: (err) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            this.saveVideoToAlbum(res.tempFilePath);
          } else {
            wx.hideLoading();
            // 处理 400 错误（视频过大等情况）
            if (res.statusCode === 400) {
              const fs = wx.getFileSystemManager();
              try {
                const jsonStr = fs.readFileSync(res.tempFilePath, 'utf8');
                const errData = JSON.parse(jsonStr);
                wx.showModal({
                  title: '下载失败',
                  content: errData.msg || '视频可能过大，请尝试其他视频',
                  showCancel: false
                });
              } catch (e) {
                wx.showModal({ title: '下载失败', content: '视频可能过大或链接已失效', showCancel: false });
              }
            } else {
              wx.showModal({ title: '下载失败', content: '服务器返回错误: ' + res.statusCode, showCancel: false });
            }
          }
        },
        fail: (err) => {
          wx.hideLoading();
          wx.showModal({ title: '下载失败', content: '需配置域名白名单或使用云存储方案。\n' + err.errMsg, showCancel: false });
        }
      });
    }
  },

  // 抽离出来的保存逻辑
  saveVideoToAlbum(tempFilePath) {
    wx.saveVideoToPhotosAlbum({
      filePath: tempFilePath,
      success: () => {
        wx.hideLoading();
        wx.showToast({ title: '保存成功！', icon: 'success' });
      },
      fail: (err) => {
        wx.hideLoading();
        // 处理权限或 iOS 格式问题
        this.checkAuth(err);
        if (err.errMsg && !err.errMsg.includes('auth')) {
          wx.showModal({ title: '保存相册失败', content: '可能是视频格式iOS不支持。\n' + err.errMsg, showCancel: false });
        }
      }
    });
  },

  handleSaveImages() {
    const images = this.data.result;
    if (!images || !images.length) return;

    wx.showLoading({ title: '准备保存...' });
    let successCount = 0;
    let failCount = 0;

    images.forEach((url) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                successCount++;
                this.checkSaveStatus(images.length, successCount, failCount);
              },
              fail: (err) => {
                failCount++;
                this.checkAuth(err);
                this.checkSaveStatus(images.length, successCount, failCount);
              }
            });
          } else {
            failCount++;
            this.checkSaveStatus(images.length, successCount, failCount);
          }
        },
        fail: () => {
          failCount++;
          this.checkSaveStatus(images.length, successCount, failCount);
        }
      });
    });
  },

  checkSaveStatus(total, success, fail) {
    if (success + fail === total) {
      wx.hideLoading();
      if (fail === 0) wx.showToast({ title: '全部保存成功', icon: 'success' });
      else wx.showToast({ title: `成功${success}张，失败${fail}张`, icon: 'none' });
    }
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.url;
    wx.previewImage({ current, urls: this.data.result });
  },

  checkAuth(err) {
    if (err && err.errMsg && (err.errMsg.includes('auth deny') || err.errMsg.includes('authorize:fail'))) {
      wx.showModal({
        title: '权限提示',
        content: '保存到相册需要您的授权，请点击确定去开启权限。',
        success: (res) => { if (res.confirm) wx.openSetting(); }
      });
    }
  },

  onShareAppMessage() {
    return { title: '一键提取无水印高清视频', path: '/pages/index/index' };
  },

  onShareTimeline() {
    return { title: '这款去水印工具太好用了，推荐给你！' };
  },

  goHistory() {
    wx.reLaunch({ url: '/pages/history/history' });
  },

  onLeftBtnTap() {
    if (this.data.inputUrl) {
      this.clearInput();
    } else {
      this.onlyPaste();
    }
  },

  // 📺 B 站专用解析函数 (修复遮罩不消失的问题)
  handleBilibiliParse(url) {
    wx.cloud.callContainer({
      config: { env: this.config.envId },
      path: `/api/bilibili/parse?url=${encodeURIComponent(url)}`,
      header: {
        'X-WX-SERVICE': this.config.serviceName
      },
      method: 'GET',
      success: (res) => {
        // ✅ 先检查 HTTP 状态码
        if (res.statusCode !== 200) {
          // 特别处理 400 错误（视频过大等情况）
          if (res.statusCode === 400) {
            const errMsg = res.data?.msg || '视频可能过大或链接无效';
            wx.showToast({ title: errMsg, icon: 'none', duration: 3000 });
          } else {
            wx.showToast({ title: '服务繁忙: ' + res.statusCode, icon: 'none' });
          }
          return;
        }

        const data = res.data;

        // ✅ 只要后端返回成功 (200)，无条件放行！
        if (data.status === 'success' || data.code === 200) {
          const info = data.data;
          const proxyUrl = this.data.cloudDomain + info.video_url;

          this.setData({
            result: proxyUrl,
            isImageMode: false,

            meta: {
              ...this.data.meta,
              title: info.desc || 'B站视频',
              desc: info.desc || '',
              coverUrl: info.cover_url || '',
              videoUrl: proxyUrl,
              author: { name: 'Bilibili UP主', avatar: '../../assets/icons/avatar.png' },
              stats: { digg: 0, comment: 0, collect: 0, share: 0 },
              tags: []
            }
          });

          // 存入历史记录
          this.saveToHistory({
            id: new Date().getTime(),
            title: info.desc || 'B站视频',
            desc: info.desc || '',
            coverUrl: info.cover_url || '',
            type: '视频(B站)',
            shareUrl: url,
            timeText: this.formatTime(new Date())
          });

          wx.showToast({ title: '解析成功', icon: 'success' });

        } else {
          wx.showToast({ title: '解析失败: ' + (data.msg || '未知错误'), icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('B站解析请求失败', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      },

      // ✨✨✨ 核心修复：无论成功失败，都在这里关闭转圈圈 ✨✨✨
      complete: () => {
        wx.hideLoading(); // 关掉系统的小圈圈
        this.setData({ isLoading: false }); // 关掉你那个白色方块遮罩！
      }
    });
  },

});
