import fs from 'fs';
import os from 'os';
import path from 'path';
import querystring from 'querystring';



/**
 * parse upload file by ajax
 * @param  {} http []
 * @return {}      []
 */
think.middleware('parse_single_file_payload', http => {

  if(!http.req.readable){
    return;
  }

  let filename = http.req.headers[think.config('post.single_file_header')];
  if(!filename){
    return;
  }
  
  let deferred = think.defer();
  let uploadDir = think.config('post.file_upload_path') || (os.tmpdir() + think.sep + 'thinkjs_upload');
  think.mkdir(uploadDir);

  let name = think.uuid(20);
  let filepath = uploadDir + '/' + name + path.extname(filename).slice(0, 5);
  let stream = fs.createWriteStream(filepath);
  http.req.pipe(stream);
  stream.on('error', err => {
    http.res.statusCode = 400;
    http.end();
    //log error
    if(http.config('post.log_error')){
      think.log(err);
    }
  });
  stream.on('close', () => {
    http._file.file = {
      fieldName: 'file',
      originalFilename: filename,
      path: filepath,
      size: fs.statSync(filepath).size
    };
    deferred.resolve(null);
  });
  return deferred.promise;
});


/**
 * parse payload
 * @param  {Object} http
 * @return {}         []
 */
think.middleware('parse_json_payload', http => {

  if(!http.req.readable){
    return;
  }

  let types = http.config('post.json_content_type');
  if (types.indexOf(http.type()) === -1) {
    return;
  }
  return http.getPayload().then(payload => {
    let data;
    try{
      data = JSON.parse(payload);
    }catch(e){
      //log error
      if(http.config('post.log_error')){
        think.log(new Error('JSON.parse error, payload is not a valid JSON data'));
      }
      //if using json parse error, then use querystring parse.
      //sometimes http header has json content-type, but payload data is querystring data
      data = querystring.parse(payload);
    }
    if(!think.isEmpty(data)){
      http._post = think.extend(http._post, data);
    }
    return null;
  });
});


/**
 * parse payload by querystring
 * @param  {Object} http []
 * @return {[type]}      []
 */
think.middleware('parse_querystring_payload', http => {

  if (!http.req.readable) {
    return;
  }
  
  return http.getPayload().then(payload => {
    http._post = think.extend(http._post, querystring.parse(payload));
  });
});


/**
 * validate data parsed from payload 
 * @param  {Object} http []
 * @return {}      []
 */
think.middleware('validate_payload', http => {
  let post = http._post;
  let length = Object.keys(post).length;
  if (length > think.config('post.max_fields')) {
    http.res.statusCode = 400;
    http.end();
    return think.prevent();
  }
  let maxFilesSize = think.config('post.max_fields_size');
  for(let name in post){
    if (post[name] && post[name].length > maxFilesSize) {
      http.res.statusCode = 400;
      http.end();
      return think.prevent();
    }
  }
});