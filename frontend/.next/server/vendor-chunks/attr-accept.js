"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/attr-accept";
exports.ids = ["vendor-chunks/attr-accept"];
exports.modules = {

/***/ "(ssr)/./node_modules/attr-accept/dist/es/index.js":
/*!***************************************************!*\
  !*** ./node_modules/attr-accept/dist/es/index.js ***!
  \***************************************************/
/***/ ((__unused_webpack_module, exports) => {

eval("\n\nexports.__esModule = true;\n\nexports[\"default\"] = function (file, acceptedFiles) {\n  if (file && acceptedFiles) {\n    var acceptedFilesArray = Array.isArray(acceptedFiles) ? acceptedFiles : acceptedFiles.split(',');\n\n    if (acceptedFilesArray.length === 0) {\n      return true;\n    }\n\n    var fileName = file.name || '';\n    var mimeType = (file.type || '').toLowerCase();\n    var baseMimeType = mimeType.replace(/\\/.*$/, '');\n    return acceptedFilesArray.some(function (type) {\n      var validType = type.trim().toLowerCase();\n\n      if (validType.charAt(0) === '.') {\n        return fileName.toLowerCase().endsWith(validType);\n      } else if (validType.endsWith('/*')) {\n        // This is something like a image/* mime type\n        return baseMimeType === validType.replace(/\\/.*$/, '');\n      }\n\n      return mimeType === validType;\n    });\n  }\n\n  return true;\n};//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvYXR0ci1hY2NlcHQvZGlzdC9lcy9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBYTs7QUFFYixrQkFBa0I7O0FBRWxCLGtCQUFlO0FBQ2Y7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsUUFBUTtBQUNSO0FBQ0E7QUFDQTs7QUFFQTtBQUNBLEtBQUs7QUFDTDs7QUFFQTtBQUNBIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdmxtY2xhc3NpZmllci1mcm9udGVuZC8uL25vZGVfbW9kdWxlcy9hdHRyLWFjY2VwdC9kaXN0L2VzL2luZGV4LmpzPzJjYzgiXSwic291cmNlc0NvbnRlbnQiOlsiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uIChmaWxlLCBhY2NlcHRlZEZpbGVzKSB7XG4gIGlmIChmaWxlICYmIGFjY2VwdGVkRmlsZXMpIHtcbiAgICB2YXIgYWNjZXB0ZWRGaWxlc0FycmF5ID0gQXJyYXkuaXNBcnJheShhY2NlcHRlZEZpbGVzKSA/IGFjY2VwdGVkRmlsZXMgOiBhY2NlcHRlZEZpbGVzLnNwbGl0KCcsJyk7XG5cbiAgICBpZiAoYWNjZXB0ZWRGaWxlc0FycmF5Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgdmFyIGZpbGVOYW1lID0gZmlsZS5uYW1lIHx8ICcnO1xuICAgIHZhciBtaW1lVHlwZSA9IChmaWxlLnR5cGUgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgdmFyIGJhc2VNaW1lVHlwZSA9IG1pbWVUeXBlLnJlcGxhY2UoL1xcLy4qJC8sICcnKTtcbiAgICByZXR1cm4gYWNjZXB0ZWRGaWxlc0FycmF5LnNvbWUoZnVuY3Rpb24gKHR5cGUpIHtcbiAgICAgIHZhciB2YWxpZFR5cGUgPSB0eXBlLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG4gICAgICBpZiAodmFsaWRUeXBlLmNoYXJBdCgwKSA9PT0gJy4nKSB7XG4gICAgICAgIHJldHVybiBmaWxlTmFtZS50b0xvd2VyQ2FzZSgpLmVuZHNXaXRoKHZhbGlkVHlwZSk7XG4gICAgICB9IGVsc2UgaWYgKHZhbGlkVHlwZS5lbmRzV2l0aCgnLyonKSkge1xuICAgICAgICAvLyBUaGlzIGlzIHNvbWV0aGluZyBsaWtlIGEgaW1hZ2UvKiBtaW1lIHR5cGVcbiAgICAgICAgcmV0dXJuIGJhc2VNaW1lVHlwZSA9PT0gdmFsaWRUeXBlLnJlcGxhY2UoL1xcLy4qJC8sICcnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG1pbWVUeXBlID09PSB2YWxpZFR5cGU7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07Il0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/attr-accept/dist/es/index.js\n");

/***/ })

};
;