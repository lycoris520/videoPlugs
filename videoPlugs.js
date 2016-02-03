//注意考虑到$获取的父节点可能有多个的问题  如果界面上有多个相同的id  只获取第一个  一个id下只能获取下一级的一个
;(function($){
	//阻止浏览器默认事件
	var keyboardAllowed = typeof Element !== 'undefined' && 'ALLOW_KEYBOARD_INPUT' in Element;
	var fn = (function () {
		var val;
		var valLength;
		
		var br=navigator.userAgent.toLowerCase();  
		var fnMap = [
			[
				'requestFullscreen',
				'exitFullscreen',
				'fullscreenElement',
				'fullscreenEnabled',
				'fullscreenchange',
				'fullscreenerror'
			],
			// new WebKit
			[
				'webkitRequestFullscreen',
				'webkitExitFullscreen',
				'webkitFullscreenElement',
				'webkitFullscreenEnabled',
				'webkitfullscreenchange',
				'webkitfullscreenerror'
	
			],
			// old WebKit (Safari 5.1)
			[
				'webkitRequestFullScreen',
				'webkitCancelFullScreen',
				'webkitCurrentFullScreenElement',
				'webkitCancelFullScreen',
				'webkitfullscreenchange',
				'webkitfullscreenerror'
	
			],
			[
				'mozRequestFullScreen',
				'mozCancelFullScreen',
				'mozFullScreenElement',
				'mozFullScreenEnabled',
				'mozfullscreenchange',
				'mozfullscreenerror'
			],
			[
				'msRequestFullscreen',
				'msExitFullscreen',
				'msFullscreenElement',
				'msFullscreenEnabled',
				'MSFullscreenChange',
				'MSFullscreenError'
			]
		];
	
		var i = 0;
		var l = fnMap.length;
		var ret = {};
	
		for (; i < l; i++) {
			val = fnMap[i];
			if (val && val[1] in document) {
				for (i = 0, valLength = val.length; i < valLength; i++) {
					ret[fnMap[0][i]] = val[i];
				}
				return ret;
			}
		}
		return false;
	})();
	$.fn.extend({
		//节点定义    最外层父元素包裹所有子元素    子元素为5部分  video视频 control控制栏 subtitle字幕 barrage弹幕 cover封面
		videoPlugs        : function(option){
			//如果已经有videoWindow对象就直接返回
			if(this.videoWindow){
				console.log(1);
				return this.videoWindow;
			}
			var defaults           = {
				src         :"",          //视频地址
				subtitle_src:'./php/index.php',          //字幕源文件
				cover_url   : 'http://img2.niutuku.com/desk/1208/1516/ntk-1516-42359.jpg',				  //封面图片地址
				barrageGet  :"/php/index.php",           //弹幕获取地址
				barrageSet  :"/php/index.php",           //弹幕设置地址
				width       : 400,                       //视频窗口的宽
				show_cover  : true,			         //视频暂停是否显示封面(广告)
				showBarrage : false,             		 //是否显示弹幕
				showSubtitle: false,               	     //是否显示字幕
				control     : 1 ,               		 //0为不显示 1为自定义 2为系统
			};
			//对象私有变量定义
			var config             = $.extend(defaults,option);                			//替换默认配置
		      	 var container          = this; 												//当前容器 一个jquery对象
		      	 var content            = null;												//视频直接父元素
		         var video              = null;												//视频对象
		         var control            = null;                                            	//控制栏对象
		         var subtitle           = null;												//字幕
		         var barrage            = null; 												//弹幕
		         var cover              = null;												//封面
		  	 var barrageInterval    = null;     											//弹幕定时器
			//清除parent的子节点
			var empty              = function(parent){                                  //清除当前对象的所有子节点
				if( !parent ) throw new Error("没有当前对象!");
				parent.empty();
			}
			
			//获取当前video的位置和长宽
			var getVideoInfo       = function(video){
				var obj          = {
					width   : $(video).width(),
					height  : $(video).height(),
					top     : video.getBoundingClientRect().top,
					left    : video.getBoundingClientRect().left,
				}
				return obj;
			}
			
			//获取时分秒    给一个time参数 返回时分秒
			var getDetailtime      = function(time){
				time         = Math.ceil(time);
				var timeStr      = '';
				var hour         = Math.floor(time/3600);
				var minute       = Math.floor((time-(hour*3600))/60);
				var second       = time%60;
				if(hour < 10){ 
					timeStr     += ("0"+hour+":");      
				}else{
					timeStr     += (hour+":");
				}
				if(minute < 10){
					timeStr     += ("0"+minute+":");      
				}else{
					timeStr     += (minute+":");
				}
				if(second < 10){
					timeStr     += ("0"+second);      
				}else{
					timeStr     += second;
				}
				return timeStr;
			}
			
			//获取秒数
			var getSeconds        = function(time){
				var timer         = time.split(":");
				var seconds = (parseInt(timer[0])*3600)+(parseInt(timer[1])*60)+(parseFloat(timer[2]));
				return seconds;
			}
			
			//解析srt字幕文件
			var srtSubtitle       = function(data){
				var subArray      = data.split("\r\n");
				var subtitle      = [];
				var index =1;
				//解析处理
				for(var i = 0 ; i < subArray.length; i++ ){
					var obj      = {};
					if(parseInt(subArray[i]) == index){
						var timeDur   =  subArray[++i].replace(/,/g,'.').split("-->");
					    obj.start     = getSeconds((timeDur[0]).trim());
					    obj.end       = getSeconds((timeDur[1]).trim());
					    obj.text      = subArray[++i];
						subtitle.push(obj);
						index++;
					}
				}
				return subtitle;
			}
			//制作字幕
			var makeSubtitle      = function(data){
				var subArr        = srtSubtitle(data);
				return subArr;
			}
			
			//发送弹幕          text为发送的文本  style为发送的文本样式 id为发送的id
			var showBarrage        = function(text,style,id){
				var $span          = $("<span style='position:absolute;display:block;white-space:nowrap;font-size:18px;color:#fff;font-weight:bold'>"+text+"</span>");
				if(id){
					$span.attr("id",id);
				}
				if(style && typeof(style) == "object"){
					$.each(style,function(key,value){
						$span.css(key,value);
					});
				}
				$span.css("left",barrage.width());
				//计算出现的位置
				$span.css("top",math.floor(math.random()*($pub_barrage.css("length")-50)+1));
				//控制界面上的位置
				barrage.append($each);
			}
			
			//显示弹幕内容
			var requestTime        = 0;
			var barrageArr         = [];   				 //页面上显示弹幕数组本地
			var barrageInfo        = [];          		 //弹幕数组,网络获取 
			var barrageTime        = null;               //弹幕添加的时间,避免同一时间重复
			var makeBarrage        = function(){
				if(!config.barrageGet){
					return;
				}
				//等于0判断为了让第一次进入获取数据  一分钟获取一次实时数据
				if(requestTime >= 10 || requestTime == 0){
					requestTime = 1;
					//请求弹幕数据
					$.ajax({
						type:"get",
						url:config.barrageGet,
						async:true,
						success : function(result){
							//数据格式  {status:true,info : [{id:32,text:"我是发送的弹幕哟",time:"343.454",style:{"color":red}}]}
							if(status){
								barrageInfo            = result.info;
							}
							console.log(result);
						}
					});
				}
				if(barrageInfo == undefined ||typeof(barrageInfo) != "object"){
					return;
				}
				var currentTime     = video[0].currentTime;
				//根据当前时间判断是否有弹幕需要显示
				$.each(barrageInfo, function(index,value) {
					if(barrageTime == video[0].currentTime){				//判断上一次加载弹幕的当前时间是否一样,一样则不执行操作
						return;
					}
					if(value.time >= currentTime && value.time <= currentTime+0.05){
						that.sendBarrage();
					}
				});
				requestTime++;
			};
					
			var videoWindow        = function(config){									//视频操作对象
				if ( !(this instanceof videoWindow) ){
		            return new videoWindow( config);
		        }
				this.init();
                        return this;
			};
			
			videoWindow.prototype = {
				//初始化配置
				init              : function(){
					var that     = this;
					//检查必要的参数
					if(!config.width) throw new Error("宽不能为空");
					
					//初始化参数    为了reload时重置
				    control = null;
				    barrage = null;
				    subtitle= null;
				    cover   = null;
				    
					that.creatVideo();												  //创建video对象
					//根据配置参数进行操作
					
					//控制栏
					if(config.control == 2){								    	  //判断控制栏  1为自定义 0为不显示  2为系统
						video.attr("controls","controls");
					}else if(config.control == 1){
						//显示自定义控制栏
						that.showControls();
					}
					
					//字幕   true为显示 false为不显示
					if(config.showSubtitle){
						that.showSubtitle();
					}
					
					//弹幕   true为显示 false为不显示
					if(config.showBarrage){
						that.showBarrage();
					}
					
					//封面   true为显示 false为不显示
					if(config.show_cover){
						that.showCover();
					}
				},
				//重置视频 options 重新配置参数
				reload            : function(option){
					config = $.extend(config,option);
					this.init();
				},
				//创建视频
				creatVideo        : function(){
					//清除container的子节点  防止重复创建
					empty(container);
					var $content    = $("<div style='position:relative;text-align:center;overflow:hidden;background:black;display:inline-block;padding:0 !important;margin:0 !important;' id='vd_videoPanel'></div>");
					var $video      = $("<video style='width:100%;height:100%;margin:0 auto;'> <source src='"+config.src+"' -webkit-playsinline=true></source> browser does not support the video tag.</video>");
					$content.css("width",config.width);
					$content.css("height",parseInt(config.width/16*9));
					//添加元素
					$content.append($video);
					container.append($content);					
					//当前对象的video 及父元素
					content         = $content;
					$video.unbind("timeupdate");
					video           = $video;
				},
				//测试用
				getBuffer          : function(){
					for(var i= 0; i<video[0].buffered.length;i++){
						console.log(video[0].buffered.start(i)+"------------"+video[0].buffered.end(i));
					}
				},
				//全屏播放
				fullScreen        : function(ele){
					var request = fn.requestFullscreen;
					ele = ele || document.documentElement;
					if (/5\.1[\.\d]* Safari/.test(navigator.userAgent)) {
						ele[request]();
					} else {
						ele[request](keyboardAllowed && Element.ALLOW_KEYBOARD_INPUT);
					}
					$(ele).css("width",window.screen.width);
					$(ele).css("height",window.screen.height);
					//如果有弹幕  重新设置弹幕的高度
					if(barrage){
						barrage.css("height",content.height()-subtitle.height()-40);
						//弹幕高度  如果有字幕则弹幕高度减去字幕  
						if(subtitle){
							barrage.css("height",content.height()-subtitle.height()-40);
						}
					}
				},
				//退出全屏
				exitFullScreen   : function(ele){
					$(ele).css("width",config.width);
					$(ele).css("height",parseInt(config.width/16*9));
					//如果有弹幕  重新设置弹幕的高度
					if(barrage){
						barrage.css("height",content.height()-subtitle.height()-40);
						//弹幕高度  如果有字幕则弹幕高度减去字幕  
						if(subtitle){
							barrage.css("height",content.height()-subtitle.height()-40);
						}
					}
					document[fn.exitFullscreen]();
				},
				//显示字幕
				showSubtitle       :function(){
					if(!config.subtitle_src){
						return;
					}
					//如果已存在就显示 不存在就创建
					if(subtitle){
						subtitle.show();
						return;
					}
					//创建字幕
					var $subtitle          = $("<div status='subtitle' style='position:absolute;bottom:40px;left:0;right:0;margin:0;padding:2px 10px;text-align:center;box-sizing:border-box;overflow:hidden;height:30px;width:100%;background:none'><p style='margin:0;padding:0;text-algin:center;color:fff;font-family:微软雅黑;'><p></div>");
					content.append($subtitle);
					subtitle               = $subtitle;
					//判断有没有字幕地址
					if(!config.subtitle_src){
						return;
					}
					$.get(
						config.subtitle_src,{run:'yxm'},
						function(result){								//获取到数据了才进行事件绑定
							if(!result){
								return ;
							}
							video.unbind("timeupdate.sub");				//先解除绑定
							video.bind("timeupdate.sub",function(){
							    var currentTime= video[0].currentTime;
								var subtitle   = makeSubtitle(result);
								for(var i = 0; i < subtitle.length; i++){
									if(currentTime >= subtitle[i].start && currentTime <= subtitle[i].end){
										$subtitle.children("p").text(subtitle[i].text);
									}
								}
							});
						}
					);
				},
				//关闭字幕
				closeSubtitle     : function(){
					if(subtitle){
						subtitle.hide();
					}
				},
				//弹幕    避免重复问题由队列解决
				//显示弹幕
				showBarrage      :function(){
					if(barrage){
						//重新设置定时器
						clearInterval(barrageInterval);        //清除定时器
						requestTime = 0;
						barrageInterval = setInterval(function(){
	                    	makeBarrage();
	                    },1000);
						barrage.show();
					}
					var $barrage           = $("<div barrage=\"barrage\" style='position:absolute;bottom:40px;left:0;right:0;margin:0;top:0;padding:0;background:none;box-sizing:border-box;overflow:hidden;'><div style='width:100%;height:100%;position:absolute'></div></div>");
					//弹幕高度  如果有字幕则弹幕高度减去字幕  
					if(subtitle){
						$barrage.css("height",content.height()-subtitle.height()-40);
					}
                    content.append($barrage);
                    barrage                = $barrage.children("div");
                    //定时器设置
                    clearInterval(barrageInterval);
                    //清除弹幕内容,避免reload时出错
                	barrageArr  = [];
                	requestTime = 0;
                    barrageInterval = setInterval(function(){
                      	makeBarrage();
                    },1000);
				},
				//关闭弹幕
				closeBarrage     :function(){
					clearInterval(barrageInterval);        //清除定时器
					barrage.empty();                       //清除界面上数据
					barrage.hide();
				},
				//发送弹幕
				sendBarrage      :function(text){
					//如果弹幕为空的话则直接返回
					if(!barrage){
						return false;
					}
					if(trim(text) == ''){
						return;
					}
					var barrage_obj    = {};
					barrage_obj.text   = text;
					barrage_obj.time   = video.currentTime;
				    showBarrage(text);
				    if(!config.barrageSet){
				    	return;
				    }
				    $.ajax({
				    	type:"post",
				    	url:"",
				    	async:true
				    });
				},
				showCover         : function(){
					var that = this;
					if(!config.cover_url){
						cover = null;
						console.log("都不给我地址,我怎么显示!!!");
						return;
					}
					var cover_stop_btn     = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAACWCAYAAAA8AXHiAAAACXBIWXMAABcSAAAXEgFnn9JSAAA4KGlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgNS42LWMwNjcgNzkuMTU3NzQ3LCAyMDE1LzAzLzMwLTIzOjQwOjQyICAgICAgICAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgICAgICAgICAgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIgogICAgICAgICAgICB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIKICAgICAgICAgICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIj4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5BZG9iZSBQaG90b3Nob3AgQ0MgMjAxNSAoV2luZG93cyk8L3htcDpDcmVhdG9yVG9vbD4KICAgICAgICAgPHhtcDpDcmVhdGVEYXRlPjIwMTUtMTItMTZUMTU6MjI6MzMrMDg6MDA8L3htcDpDcmVhdGVEYXRlPgogICAgICAgICA8eG1wOk1vZGlmeURhdGU+MjAxNS0xMi0xNlQxNTozNDowNCswODowMDwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMTUtMTItMTZUMTU6MzQ6MDQrMDg6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2UvcG5nPC9kYzpmb3JtYXQ+CiAgICAgICAgIDxwaG90b3Nob3A6Q29sb3JNb2RlPjM8L3Bob3Rvc2hvcDpDb2xvck1vZGU+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6YmI3ZTM1MzItNDZlMC0zZjQ0LWI3ZDUtMmFiNzVlNjNjZmM4PC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54bXAuZGlkOmJiN2UzNTMyLTQ2ZTAtM2Y0NC1iN2Q1LTJhYjc1ZTYzY2ZjODwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD54bXAuZGlkOmJiN2UzNTMyLTQ2ZTAtM2Y0NC1iN2Q1LTJhYjc1ZTYzY2ZjODwveG1wTU06T3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICA8eG1wTU06SGlzdG9yeT4KICAgICAgICAgICAgPHJkZjpTZXE+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6YWN0aW9uPmNyZWF0ZWQ8L3N0RXZ0OmFjdGlvbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0Omluc3RhbmNlSUQ+eG1wLmlpZDpiYjdlMzUzMi00NmUwLTNmNDQtYjdkNS0yYWI3NWU2M2NmYzg8L3N0RXZ0Omluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDp3aGVuPjIwMTUtMTItMTZUMTU6MjI6MzMrMDg6MDA8L3N0RXZ0OndoZW4+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpzb2Z0d2FyZUFnZW50PkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE1IChXaW5kb3dzKTwvc3RFdnQ6c29mdHdhcmVBZ2VudD4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgIDwvcmRmOlNlcT4KICAgICAgICAgPC94bXBNTTpIaXN0b3J5PgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpYUmVzb2x1dGlvbj4xNTAwMDAwLzEwMDAwPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj4xNTAwMDAwLzEwMDAwPC90aWZmOllSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpSZXNvbHV0aW9uVW5pdD4yPC90aWZmOlJlc29sdXRpb25Vbml0PgogICAgICAgICA8ZXhpZjpDb2xvclNwYWNlPjY1NTM1PC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWERpbWVuc2lvbj4xNTA8L2V4aWY6UGl4ZWxYRGltZW5zaW9uPgogICAgICAgICA8ZXhpZjpQaXhlbFlEaW1lbnNpb24+MTUwPC9leGlmOlBpeGVsWURpbWVuc2lvbj4KICAgICAgPC9yZGY6RGVzY3JpcHRpb24+CiAgIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAg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";
					var $cover_content     = $("<div status=\"cover\" style='position:absolute;z-index:100;top:0;left:0;right:0;bottom:0;'></div>");
					var $cover_img         = $("<img src='"+config.cover_url+"' />");
					var $cover_btn         = $("<div status=\"stop\" style='position:absolute;top:0;left:0;right:0;bottom:0;margin:auto;width:80px;height:80px;cursor:pointer;'></div>");
					$cover_btn.css("background","url("+cover_stop_btn+")");
					$cover_btn.css("background-size","100% 100%");
					$cover_img.css("width","100%");
					$cover_img.css("height",content.height());
					
					$cover_content.bind("click",function(){
						video[0].play();
						$cover_content.fadeOut("slow");
					});
					$cover_content.append($cover_img);
					$cover_content.append($cover_btn);
					content.append($cover_content);
					cover = $cover_content;
				},
				//显示自定义控制栏   高度40
				showControls      : function(){
					var that        = this;
					//先移除系统自带控制栏
					video.removeAttr("controls");
					if(control){
					    control.fadeIn(500);
					    return;
					}
					//图片的地址
					var bar_btn_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABkAAAAZCAYAAAGz7rX1AAAACXBIWXMAABcRAAAXEQHKJvM/AAAD8klEQVR4nK1WS0wTURR9A68FaQOUbymUQlt0oYABYwQMmuhOI0RjXCmJgUDCwrU7V+4hISpGjehGDCIxbl2QIBsxIvHfFgotIr9ChfIptJ47doahnfJJuMlk3rv33f95d4aHw2G2ubmZtba2VpKSkjLIA4FANRYDeBjWVTwpKekn2yKBJyYmzkJSg01YVCEbDofjl91uL+HEvTIww4bt9jBX6DHaCD012Q687aKO3+8PpaamCtKJUCgUTgBxl8v1xWq1CuVPB5lvNcgMyRo23FAlEJ9DcJQ0iaHUJL5olmhiYuINmCkWi+Wc5JwobDabJaWwmE1kwR6PeFkI78bSfFEox37nvVN8RwRsS1BtEzW2JUiqNyMn5YpJi7GxsXec878FBQV1ooYULtH4+PhUYWFhLoui2dlZV1ZWlk3phphOMK1QiD4vEskoFI/H8xveTJxcFxUVWaUDlK6UmZSMFDcU8qDYR50OqJqPQwCSnqPCF5W5kNWoimzLjVok5gQFY4TpUCYskdfrncwHQfa/EMrqEc3PzzcvLCy0gi+kp6c/zMzMbFfK5c4BHb0wVJ+RkcHoiVDb+vp6GxIfAJROywoA3RAYFWrxa7VaBlnN6Ojoh+Li4hMc7q/FO6wkHK5cWVmpoOt2F7HKAsroct8ncd1z6ThLELaUfD7fS56dnW1VWrI86JfXRZ39bLy5Vt4jNyvXaDS7RSNTcnIy4xgFDJd+TwrBYJDxycnJP0hIRq4bIShzUNLMzIyLm0yms1h/k5iUY2/d9oMSYcLcphn0fXp6uisnJ+fGTuGgDx8RSbfYOBxuQPNsAGRNdBEwGxgMduJwM+1laEitn5ubu4VmNgmCsEFYQik7jEajbCAGfBKhekeAoReYY8a0tDSDTqfTknfsGelsbGywpaWlILo/gep5cKYDDrrVbPFoBqr3BApXUQ+dzRZzQ0RCxIwcGgwGDR4CCz21cP4IU+AH4VTVCWo1AGEZEKZXtbwHgnM9YRsZBvB0oWQtshO3292PZlRThAdBer3+EODRjMBP0qXj1DSU51Q8yFPHrr8dYf0eX4ystsDAnl0oZWqhUe9QymMYMK10xRvhLe6lIuQPTflVZeSY5PHAjq+hBlVq5ChRiNByUKVSUgSJnAN295FNG7Ctms0rRLlbueIR7Abp3nAYv+d0OltQvzK1bIjzfAdD8Qizmn4gBvH5aBfRhftQjsH+Ojc39zzmsm7fFqMIJVrCRf6MXp+hvXxPAOF6etOHAVg/TJjfr/Hl5eUVzJ+vdBnhQObH3HgIK+lNH5bFxcVWZGbClDYD+1r8SogAoWFG5cBIEcfK6urqYl5eXhNGDwUY4/wfjA/GOHVgQMUAAAAASUVORK5CYII=";
					var start_url   = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAXCAYAAAF8Gl81AAAACXBIWXMAABcRAAAXEQHKJvM/AAAAdUlEQVR4nGNZsmTJf09PT5Pt27efYWFAAqgckDIUURYMKZgpGJqxmoihPTo6mnHp0qX/caukhSDMdhgAeUJISOgszCV4dRNtzWBTiO5rUNi/e/fOGBZ9NLR6VCGdFaLHNTqApXgQG1saINtmYsGogaMGDksDAZypNR6B/WUiAAAAAElFTkSuQmCC";
					var stop_url    = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAsCAYAAAF6VCpjAAAACXBIWXMAABcRAAAXEQHKJvM/AAAEdUlEQVR4nGN5+/atmpCQ0C0GJMAyY8aMmyCGgYHBHC8vr1SwIEz2woULKSBcVVXFyMKABtra2v6jCIJUgbUzMjL+FxMTu5icnGwIt+jdu3cqgoKCd+AC06dPv42iDdlgJiam3yiG//v3jxXDNhZk/WAzWltb/6O7Bx2gGAOyDJsGDO9i04BTEQgAQzMdGKqzMBRVVFSwA/33C8VNkyZNepKbmyuDz0SWz58/S4PsDwgIiNTS0lqBVRGMsWHDhuUgjC0YsEYmMG3czsjIUMOpCASA0agKUlxWVsbNwsLyDW8QdHV1fcVpEjIAemYlXkUYiQQZpKenawoLC9/A6nCgI78DHcuFrgmuCFcyAStCTk/i4uIXkJM0KQDFSS9fvjSAJSOQ80pKSgTQEwRRBiGDP3/+cHZ0dPyE8YExqQGM0ZskG4QOgCUEPGRBJQSopCDLIGSwbdu22SAMYmtqaq4KDAwMJ8sgZHD9+vUwEKbIIFDJA4oQgokbG0DPQjBAlEH6+vrzvL29k/GpwWkQviIBq0G8vLxPQeUJiJOTk6PAx8f3kFjNKAbNmTPnvJSU1ElPT88McgyAGwTKFiB8/vz59ISEBAuQoWQZhMxZsGDBCR4enhd5eXmSFBkEAl++fJEAZVx7e/taa2vrFrINgoGDBw82Hzp0qKmwsFCEg4PjHdkGgcD///8Z+/r63srLy++Pjo52ItsgGHj48KEjyLtRUVGuCgoKe8g2CAaWLVu2m5OT8x3IuyAHk20QCHz//l0I6Lp/VlZWHQ4ODpVkGwQDx44dqwBhYFKRBiaZZxSXR8A6/SmwxEyj2CAQOHz4cB1VDAJmdkWKDEIOcLIMgiYBUSDzH0yMZINwJUqiDQJmkwPAbOKIS56gQaBmbkFBgRjQO2/wqcNrEClFCVaDyCncMAwit7iFG6Sqqro5NDTUj1QD4AYtXbp074MHD+CFFisr6zdbW9sGc3PzfmBA/yHXYLIdhOwYEPj9+zfXvn37ukAY6KB/hoaGsxwdHSvZ2dk/0MVB+CSBRT/TuXPnMkAYxFdWVt7h7u6eLSAgcG9AHIQO7t696zFt2rS7ILaIiMg1UGNBVlb28IA5CBm8efNGa/HixYdAbC4urjdOTk6lenp6CxnQqii6OQgZfPv2TWTLli3zQZiZmfknqPQF4nYQe0AchAz+/v3LDqyY6kEYxNfR0Vni4uJSDAzFVwPiIHRw5cqVGBAGsWVkZI6C0p2oqOiVAXMQMnjy5In17NmzL4PYoJwKzLE5wJy7fcAchAw+fPigtHLlym0gNrCM+wjMFOXAMm/mgDkIGfz8+ZN/+/btM06dOlUwKBwEA8AMsHTAHQRMS/dBpT8sLQ2Ig4C57Rg0t11Gl6Obg4gtj2jmIGiJ3QktsX8Qq4+qDqJGnUaxg6C1fiaw1j9EqVlkO0hRUXG3h4dHFvJANLUAUQ6iZ8sRNA7/D9QyRJcAtq2/2tnZNZiZmU2gZ9uaBTTKd+TIkdqPHz8qgGYigB2fVjU1tQ30cgA6AADZu7Gwzs7EFgAAAABJRU5ErkJggg==";
					var loading     = "data:image/gif;base64,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";
					var fullScr_url = "data:image/png;base64,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";
					var exitFull_url= "";
					var muted_url   = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAfCAYAAAGDnp2sAAAACXBIWXMAABcRAAAXEQHKJvM/AAADiUlEQVR4nLVWbUhTURjexp01R7ZNkVJwQ5eSuAaDoM3GWPgjSXAVwqYERtDffhT9S6iEPn7VnygMoh+6oWxOxIkowRTKr3A6UCSFNWnhV1tO29hn7xney9127tyF7YFxz71nz/u873vO+55DJJNJDkJ/f3+yq6uLS6AB5xhDQ0MBgkNDR0eHiJDJZBaPx2NEH0ZHR9cI0gYCxU8Zo3PTeBRnaWnp1erq6mOSkmYDB4Jp4ujoSEaQJhDMZnMkkUjw0VgoFHrS/LRYLCGj0SjIMovTZnRoe3tbz+jQ1NTUF8bJNM1M8Hi8SCpdh4eHsr29vSvkxMHBwUWTyXSKaG5uNmV6XFZWtpYyS4+TBFiSj4yM/CDf6Ymi/MmV90xEIhGJzWb7hZKYM8pMlJSU/Glvb68bGBiIsyIiCAQCH4THY00kwZoIbsba2toURGbGYF3UExMTX5mInZ2dBFaxoqLiG2lscnJyemdnR4t1FbeOCBsbG/fn5uY+KJXKnqampudZRBzJ4XC4/H6/8vg1gVWkv4A6gUoInlTcXC4XTzxp5wCRmh8bG3NrNJo7YrHYlc9yUIp6vf7G8PDwz6zWwqBIEUtLS71QU1Eogrp8FNNCUalUD10u1wtWigjV1dUOt9vdw5oYi8WEfD4/yNpVn893vbKycpq1IsT3Enq7mBUxEAhcQh6Aq39T3YqcIJs8k6uw6Z1IDY3TOhka2+12D7RyKU6RJKWImeYNBoNsfX39weLi4pvjTydvchINDQ1vpVLpoNVq9dH3ahqRqR5xiMfjgoWFhXebm5vd9O9Qs0+gZnvzsZFXr9ra2ro5Ozv7CfrxWdw8U8liBcPh8DncRDQaPQMdpw/OO91JRpgEwYZod3dXU1VV5aAEId+/8/UuB3DrwnM6nTZ0QEskkqXW1lZVSrAAYkwRJlpaWq6hgl9ZWXkK4nadTmcoiCCHYSsjKBSKZ6gSvV7vbbT9CxVhzq0ul8v7kCCcRPeKHiGCSCRyo2cwGLxQzDWksL+/fxk9y8vL5wsVYc6Ukpfg+vr690WPEGr5I6rFmpoaK7Q9c9EE4f59enx8fB52qKK2tvazWq3uRt+zblM08CAVj5aXl3vJy3sOZKUUjvkwiNwlCOIfeSFOCeYwkmhsbHyNftBDxSg1sLVv4f7IlFLoMN8zv+WVUrgL+7Va7W00hvW4OjMzMxgKhc7T/pL3kfMfx1ajK382SKYAAAAASUVORK5CYII=";
					var isMuted_url = "data:image/png;base64,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";
					var barrage_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAbCAYAAAEYD9+6AAAACXBIWXMAABcRAAAXEQHKJvM/AAACNklEQVR4nGP5//8/Q0RE5H8GIBATE7vHAuOAwKtXr5RYGNAAy4oVyxlnzpw5Nz09PRksANTyD2gOI5gDY4A5GPqAssyMjIx/UfRg2IBLAiy5ePEiztjYuO9YJWfPnjNjz5496egSc+fOEWbBJgECyckpbzG8iWIs9SW1tDQPgkMExAGFOYwN1zlnzpzpu3fvycBnPFYrydEE1kiOJso0SklJ3Xj27JkGyRr7+no1QYx9+/anzJo1azZMAj0UMTTCGE5OjnNAGMbftm1boZeXVz9OjV++fBGqrKw6DcoThJwHTOH/nZ2dZ6WkJGewgFIXIQ0wAEr4oFTKyMjwn6xQ3bNnbzpZGkE2D0ACGOYaZWVlr7Boa2vvu3r1qhMpGjs62o1ZamtrnEEFZmZm1uMPHz5IgiSamhqt1dTUjhF0KqiUnTFjutT79++ls7NzHvb19a8F8iUJaoQBQUHBp8uWLWW5ePGiByHngnNHeXnF+Tdv3sgR9h35QERE5FFnZ4chCygr0toyEADZAbKLhZh8Ty2Atd6lNRi1cBhYyMTE9Pffv3/M9LAMZBdLUFBgy5o1a+vpYWFwcFAzS0hISENgYGDr/v0HkkBV5YMHDwxxaZCXl78IqkpJsURMTPyenp7ubmD9PRvcUgUJMjMz/3ZxcZ4JwiD+z58/uTdv3ly6efOWEhAbpllTU/NQQkJ8Hrk+BAGsiYadnf0ryOcgDOI/fPhIf8mSJd07duzINTY22qyrq7ubXAsBcxXxHiznyo4AAAAASUVORK5CYII=";
					//控制栏面板
					var $controlPanl       = $("<div status='loading' style='height:40px;background:none;position:absolute;bottom:0;left:0;right:0;padding:0 !important;margin:0 !important;color:rgb(204,204,204);'></div>")
					//视频进度条
					var $pro_barcopy       = $("<div style='position:absolute;cursor:pointer;height:10px;background:rgba(44,32,58,0.5);;width:100%;top:0px;overflow:hidden;padding:0 !important;margin:0 !important;'></div>")
					var $pro_bar           = $("<div percent=0 status='play' style='height:100%;background:rgb(0,124,125);width:0%;position:relative;padding:0 !important;margin:0 !important;'></div>")
					var $pro_bar_buff      = $("<div percent='0' style='background:rgba(255,255,255,0.2);border:1px solid rgba(200,200,200,0.2);position:absolute;top:0;left:0;bottom:0;width:0'></div>");
					//按钮组面板
					var $contro_btn_group  = $("<div style='width:100%;height:30px;padding:0 10px !important;margin:0;;margin-top:10px;background:rgba(41,41,41,0.8);box-sizing:border-box'></div>")
					//进度条按钮
					var $bar_btn           = $("<div style='display:inline-block;width:10px;height:10px;padding:0 !important;margin:0 !important;overflow:hidden;cursor:pointer;position:absolute;right:-5px;background-image:url("+bar_btn_url+");background-size:10px'></div>");
					//播放暂停按钮
					var $btn_status        = $("<div style='display:inline-block;width:15px;height:30px;padding:0 !important;overflow:hidden;cursor:pointer;float:left;margin:0 7px;background:url("+stop_url+") no-repeat center center;background-size:15px;'></div>")
					//全屏按钮
					var $btn_full          = $("<div status='no' style='display:inline-block;float:right;width:15px;padding:0 !important;height:30px;overflow:hidden;cursor:pointer;margin:0 7px;background:url("+fullScr_url+") no-repeat center center;background-size:15px;'></div>");
					//时间显示
					var $time              = $("<div status='time'style='display:inline-block;height:30px;line-height:30px;overflow:hidden;padding:0 !important;margin:0 7px;float:left;'><span id='currentTime'>00:00:00</span>/<span id='durationTime'>00:00:00</span></span></div>")
					var $btn_audio         = $("<div style='position:relative;display:inline-block;width:auto;height:30px;overflow:hidden;cursor:pointer;padding:0 !important;margin:0 3px;padding-left:20px !important;float:right;'></div>");
					//静音
					var $audio_muted       = $("<div status='noMuted' style='margin:0;padding:0;width:15px;height:15px;position:absolute;top:7px;left:0px;background:url("+muted_url+") no-repeat left center;background-size:15px;'></div>");
					//声音面板
					var $audio_content     = $("<div style='margin:0;padding:0;width:80px;background:#eee;height:7px;border-radius:90px;margin-top:11px;'></div>");
					var $audio_bar         = $("<div style='margin:0;padding:0;width:0;height:7px;background:rgba(0,124,125,1);border-radius:90px'></div>");
					
					//添加样式
					$controlPanl.css("font-size",12);
					$audio_bar.css("width",80*video[0].volume);               //设置音量进度条
					
					//事件绑定
					var videoInfo          = getVideoInfo(video[0]);
					//video事件绑定
					video.bind("error",function(e){	    //当音视频加载被异常终止时产生该事件   当加载媒体发生错误时产生该事件  
						console.log(e);
					});
					video.bind("canplay",function(e){			        //当浏览器可以开始播放该音视频时产生该事件
						//loading取消,状态变为暂停待播放状态
						control.attr("status","canplay");
						if(video[0].paused ){
						    $btn_status.css("background-image","url("+stop_url+")");
						}else{
							$btn_status.css("background-image","url("+start_url+")");
						}
					});
					video.bind("loadstart",function(e){			        //客户端开始请求数据 
						$btn_status.css("background-image","url("+loading+")");
					});
					video.bind("ended",function(e){					    //当前播放列表结束时产生该事件
						console.log("ended");
					});
					video.bind("loadedmetadata",function(e){			//当收到总时长，分辨率和字轨等metadata时产生该事件
						$time.find("#durationTime").text(getDetailtime(video[0].duration));
					});
					video.bind("timeupdate",function(e){				//播放时间改变
						//获取当前时间显示在界面上   判断是否显示字幕 显示字幕实时更新字幕
						var currentTime   = video[0].currentTime;				//当前播放时间
						var totle         = video[0].duration;					//总长度
						var progress      = parseInt((currentTime/totle)*100);	//当前播放进度
						var totleTime     = getDetailtime(totle);
						var crtTime       = getDetailtime(currentTime);
						var buffered      = video[0].buffered.end(0)			//当前已缓冲长度
						for(var i= 0; i<video[0].buffered.length; i++){
							if(currentTime < video[0].buffered.end(i)){
								buffered  = video[0].buffered.end(i);
								break;
							}
						}
						var buff_pro      = parseInt((buffered/totle)*100);     //当前缓冲进度
						//设置当前播放进度条
						if($pro_bar.attr("percent") != progress && $pro_bar.attr("status") != "move"){
						    $pro_bar.css("width",progress+"%");
						    $pro_bar.attr("percent",progress);
						}
						//设置缓冲进度条
						if($pro_bar_buff.attr("percent") != buff_pro){
						    $pro_bar_buff.css("width",buff_pro+"%");
						    $pro_bar_buff.attr("percent",buff_pro);
						}
						//设置当前播放时间
						if((crtTime) != $time.find("#currentTime").text()){
						    $time.find("#currentTime").text(crtTime);
						}
					}); 
					video.bind("pause",function(e){				    	//当媒体暂停时产生该事件
						$btn_status.css("background-image","url("+stop_url+")");
						if(cover){
							cover.fadeIn("slow");
						}
					});
					video.bind("play",function(e){						//当媒体播放时产生该事件
						$btn_status.css("background-image","url("+start_url+")");
					});
					video.bind("playing",function(e){			   		//当媒体从因缓冲而引起的暂停和停止恢复到播放时产生该事件
						//video.play();
					});
					video.bind("stalled",function(e){					//当试图获取媒体数据，但数据还不可用时产生该事件
						console.log("stalled");
//						video.waiting();
					});
					video.bind("waiting",function(e){					//当视频因缓冲下一帧而停止时产生该事件
						//改变播放按钮状态 
						control.attr("status","loading");
						$btn_status.css("background-image","url("+loading+")");
					});
					
					//控制栏按钮事件绑定
					$btn_status.bind("click",function(e){
						//判断如果现在状态为加载的话不执行操作
						if(control.attr("status") == "loading"){
							return;
						}
						if(video[0].paused){
						    video[0].play();
						}else{
							video[0].pause();
						}
					});
					//进度条按钮事件绑定
					var pro_status  = false;
					$bar_btn.bind("mousedown touchstart",function(e){     //更改状态
						if(video == null){
							return;
						}
						pro_status    = true;
						$pro_bar.attr("status","move");
					});
					$(document).bind("mousemove touchmove",function(e){
						if(pro_status){
							var event          = e || e.event || e.originalEvent.changedTouches[0];
							var parent_width   = $pro_barcopy.width();              //进度条父元素的宽度 根据它计算进度条的百分比和宽
							//进度条面板相对浏览器的左边的距离
							var parent_left    = $pro_barcopy.offset().left;
							//鼠标位置相对浏览器的左边的距离
							var e_left         = event.pageX;
							var width          = e_left-parent_left;
							//边界值检测和设定
							if(width <= 0) {
								width = 0;
							}else if(width >= parent_width){
								width = parent_width;
							}
							var percent        = parseInt((width/parent_width)*100);			//百分比
							//设置进度条的宽度和百分比属性 为了鼠标释放之后设置播放进度
							$pro_bar.attr("percent",percent);
							$pro_bar.css("width",width);
						}
					});
					$(document).bind("mouseup touchend",function(e){
						if(pro_status){
							//获取现在播放进度条的进度 设置视频的进度
							var percent        = $pro_bar.attr("percent");
							var time           = (percent/100)*video[0].duration;
							video[0].currentTime = time;
							//更改状态  	
							$pro_bar.attr("status","play");
							pro_status    = false;
						}
					});
					
					//进度条单击事件
					$pro_barcopy.bind("click",function(e){
						var event          = e || e.event || e.originalEvent.changedTouches[0];
						var parent_width   = $pro_barcopy.width();
						//进度条面板相对浏览器的左边的距离
						var parent_left    = $pro_barcopy.offset().left;
						//鼠标位置相对浏览器的左边的距离
						var e_left         = event.pageX;
						var width          = e_left-parent_left;
						var percent        = parseInt((width/parent_width)*100);
						var time           = (percent/100)*video[0].duration;				//根据百分比计算当前应播放的时间
						//判断当前设定的时间是否超过总视频数
						if(!video[0].duration || video[0].currentTime>video[0].duration){
							return;
						}
						video[0].currentTime = time;
						$pro_bar.attr("percent",percent);
						$pro_bar.css("width",width);
					});
					//鼠标覆盖在进度条显示图片或者时间信息   待写
					$pro_barcopy.bind("mousemove",function(e){
						var event          = e || e.event || e.originalEvent.changedTouches[0];
						var parent_width   = $pro_barcopy.width();
						//进度条面板相对浏览器的左边的距离
						var parent_left    = $pro_barcopy.offset().left;
						//鼠标位置相对浏览器的左边的距离
						var e_left         = event.pageX;
						var width          = e_left-parent_left;
						var percent        = parseInt((width/parent_width)*100);
						var time           = (percent/100)*video[0].duration;				//根据百分比计算当前应播放的时间
//						console.log(time);
//						if(percent)
//						video[0].currentTime = time;
//						$pro_bar.attr("percent",percent);
//						$pro_bar.css("width",width);
					});
					
					//音量静音按钮   noMuted  未静音  muted  静音
					$audio_muted.bind("click",function(){
						if($(this).attr("status") == "isMuted"){
							$(this).attr("status","muted");
							$(this).css("background-image",function(){return "url("+muted_url+")";});
							video[0].muted = false;
						}else{
							$(this).attr("status","isMuted");
							$(this).css("background-image",function(){return "url("+isMuted_url+")";});
							video[0].muted = true;
						}
					});
					//改变声音大小
					$audio_content.bind("click",function(e){
						var event          = e || e.event || e.originalEvent.changedTouches[0];
						var $parent        = $(this).parent();
						var barWidth       = event.pageX - $parent.offset().left-19;
						var parent_width   = $audio_content.width(); 
						var percent        = barWidth/parent_width;
						if(percent > 0.85){
							percent = 1.0;
						}
						if(percent < 0.1){
							percent = 0.0;
						}
						//页面音量按钮显示图片
						if(percent <= 0){
							$audio_muted.css("background-image",function(){return "url("+isMuted_url+")";});
						}else if(percent <= 0.25){
							$audio_muted.css("background-image",function(){return "url("+muted_url+")";});
						}else if(percent <= 0.5){
							$audio_muted.css("background-image",function(){return "url("+muted_url+")";});
						}else if(percent <= 0.75){
							$audio_muted.css("background-image",function(){return "url("+muted_url+")";});
						}else{
							$audio_muted.css("background-image",function(){return "url("+muted_url+")";});
						}
						$audio_bar.css("width",barWidth);
						video[0].volume   = percent;
					});
					
					//全屏按钮事件绑定 no不是全屏 yes全屏
					$btn_full.bind("click",function(){
						if($(this).attr("status") == "no"){
							$(this).attr("status","yes");
							$(this).css("background-image","url("+fullScr_url+")");
							that.fullScreen(content[0]);
						}else{
							$(this).attr("status","no");
							$(this).css("background-image","url("+fullScr_url+")");
							that.exitFullScreen(content[0])
						}
					});
					//监听退出全屏事件
					$(document).bind("fullscreenchange webkitfullscreenchange mozfullscreenchange msfullscreenchange",function(event){
				    	setTimeout(function(){
				    		if(window.innerHeight != screen.height){
				    			$btn_full.attr("status","no");
				    			$btn_full.css("background-image","url("+fullScr_url+")");
					    		that.exitFullScreen(content[0]);				    		
					    	}
				    	},30);
				    });
//				    控制面板的淡入淡出
//				    var  hideControlTimer = null;
//				    $controlPanl.bind("hover",function(){
//						if($contro_btn_group.css("display","none")){
//							$contro_btn_group.fadeIn("slow");
//							$pro_barcopy.css("bottom",40);
//							clearTimeout(hideControlTimer);
//						}
//				    });
//				    $controlPanl.bind("mouseleave",function(){
//				    	hideControlTimer = setTimeout(function(){
//							$contro_btn_group.fadeOut('slow');
//							$pro_barcopy.css("bottom",0);
//				    	},2000);
//				    });
					//添加元素
					$pro_bar.append($bar_btn);
					$pro_barcopy.append($pro_bar_buff);
					$pro_barcopy.append($pro_bar);
					$controlPanl.append($pro_barcopy);
					$audio_content.append($audio_bar);
					$btn_audio.append($audio_muted);
					$btn_audio.append($audio_content);
					$contro_btn_group.append($btn_status);
					$contro_btn_group.append($btn_full);
					$contro_btn_group.append($btn_audio);
					$contro_btn_group.append($time);
					$controlPanl.append($contro_btn_group);
					content.append($controlPanl);
					
					control  = $controlPanl;
				}
			}
			return	new videoWindow(config);
	    }
    });
})(jQuery);
 
