const path = require('node:path');
module.exports = function documentFilename(value) {
  return path.basename(String(value || 'documento')).replace(/[\r\n"\\]/g, '_').slice(0, 180);
};
