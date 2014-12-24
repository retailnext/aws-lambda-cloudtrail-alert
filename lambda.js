// Copyright (c) 2014, RetailNext Inc.
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//   * Redistributions of source code must retain the above copyright
//     notice, this list of conditions and the following disclaimer.
//   * Redistributions in binary form must reproduce the above copyright
//     notice, this list of conditions and the following disclaimer in the
//     documentation and/or other materials provided with the distribution.
//   * Neither the name of RetailNext Inc. nor the names of its contributors
//     may be used to endorse or promote products derived from this software
//     without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL RETAILNEXT INC. BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var ses = new aws.SES({apiVersion: '2010-12-01'});
var zlib = require('zlib');
var util = require('util');

var recipients = ['email@example.com'];
var from = "cloudtail-alert@example.com";
var subject = '[CloudTrail Lambda] Change notification';

function interestingEvent(event) {
  if (event.eventName.match(/^(List|Describe|Get|CreateTag|RunInstances|TerminateInstances|ConsoleLogin)/)) {
    return false;
  } else {
    return true;
  }
}

exports.handler = function(event, context) {
  var interesting_events = [];

  var records = event.Records;
  var pendingFetches = records.length;
  records.forEach(function(record) {
    var bucket = event.Records[0].s3.bucket.name;
    var key = event.Records[0].s3.object.key;
    fetchObject(bucket, key, function(err, events) {
      if (err) {
        context.done('error', err);
        return;
      }
      interesting_events = interesting_events.concat(events);
      pendingFetches--;
      if (pendingFetches == 0) {
        sendEmail(interesting_events, function(err) {
          if (err) {
            context.done('error', err);
            return;
          } else {
            context.done(null, 'Found ' + interesting_events.length + ' interesting events');
            return;
          }
        });
      }
    });
  });
};

function fetchObject(bucket, key, callback) {
  s3.getObject({Bucket:bucket, Key:key}, function(err,resp) {
    if (err) {
      console.log('error getting object ' + key + ' from bucket ' + bucket +
                  '. Make sure they exist and your bucket is in the same region as this function.');
      callback('error getting file' + err);
      return;
    } else {
      zlib.gunzip(resp.Body, function(err, data) {
        if (err) {
          callback('error gunzipping ' + err);
          return;
        } else {
          findInterestingEvents(data, function(err, events) {
            if (err) {
              callback('ses email error ' + err);
              return;
            } else {
              callback(null, events);
              return;
            }
          });
        }
      });
    }
  });
};

function findInterestingEvents(data, callback) {
  var payload = JSON.parse(data);
  var interesting_events = [];
  payload.Records.forEach(function(rec) {
    if (interestingEvent(rec)) {
      interesting_events.push(rec);
    }
  });

  callback(null, interesting_events);
}

function sendEmail(interesting_events, callback) {
  if (interesting_events.length > 0) {
    var summary_lines = [];
    interesting_events.forEach(function(evt) {
      var username = padString(evt.userIdentity.userName||'-', 12);
      summary_lines.push(
        [evt.eventTime, username, evt.eventName].join(" ")
      );
    });

    var details = interesting_events.map(function(evt) {
      return JSON.stringify(evt, undefined, 2);
    });

    var body = summary_lines.join("\n") + "\n\n\n" + details.join("\n\n");

    ses.sendEmail({
      Source: from,
      Destination: { ToAddresses: recipients },
      Message: {
        Subject: {
          Data: subject
        },
        Body: {
          Text: {
            Data: body
          }
        }
      }
    }, function(err, data) {
      if(err) {
        callback(err);
      } else {
        callback(null);
      }
    });
  } else {
    callback(null);
  }
}

function padString(string, width) {
  var pad = string.length - width;
  var prefix = '';
  if (pad > 0) {
    prefix = Array(pad + 1).join(' ');
  }
  return prefix + string;
}
