var formatPrice = function(p){if(p===0||p===undefined)return'-';if(p<0.01)return p.toFixed(4);if(p<1)return p.toFixed(3);return p.toFixed(2)}
var formatTime = function(t){if(!t)return'';var d=new Date(t);return(d.getMonth()+1)+'月'+d.getDate()+'日 '+('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2)}
module.exports={formatPrice:formatPrice,formatTime:formatTime}
