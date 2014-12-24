# aws-lambda-cloudtrail-alert - Trigger emails on interesting CloudTrail events via AWS Lambda

aws-lambda-cloudtrail-alert is an AWS Lambda script that will monitor your CloudTrail S3 bucket and send email alerts via SES when "interesting" events occur.

## Setup

The script is designed to get you up and running quickly with minimal changes. You will need to customize the `recipients`, `from`, and `subject` variables at the top of the file. You will also probably want to tweak the `interestingEvents()` function to better match what events you find interesting.

Most of the work in getting this script running is setting up all the other AWS systems. I'll assume you already have CloudTrail configured to point to a bucket called cloudtrail.example.com. I'll also assume you already have a verified SES sender and you are using that for your "from" address.

You will need to create two IAM roles `lambda-cloudtrail-exec` and `lambda-cloudtrail-invoke`. The `lambda-cloudtrail-exec` needs a policy like this:

    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "logs:*"
          ],
          "Resource": "arn:aws:logs:*:*:*"
        },
        {
           "Effect":"Allow",
           "Action":["ses:SendEmail", "ses:SendRawEmail"],
           "Resource":"*"
        },
        {
          "Effect": "Allow",
          "Action": [
            "s3:GetObject"
          ],
          "Resource": [
            "arn:aws:s3:::cloudtrail.example.com/*"
          ]
        }
      ]
    }

It will also need a trust relationship for lambda:

     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "",
           "Effect": "Allow",
           "Principal": {
             "Service": "lambda.amazonaws.com"
           },
           "Action": "sts:AssumeRole"
         }
       ]
    }

The `lambda-cloudtrail-invoke` role needs a policy like this:

     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Resource": [
             "*"
           ],
           "Action": [
             "lambda:InvokeFunction"
           ]
         }
       ]
    }

It should have a trust relationship for the s3 bucket:

     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Sid": "",
           "Effect": "Allow",
           "Principal": {
             "Service": "s3.amazonaws.com"
           },
           "Action": "sts:AssumeRole",
           "Condition": {
             "StringEquals": {
               "sts:ExternalId": "arn:aws:s3:::cloudtrail.example.com"
             }
           }
         }
       ]
     }


Configure the Lambda function as follows:

  - Handler Name: handler
  - Role: arn:aws:iam::{YOUR\_AWS\_ACCOUNT\_NUMBER\_HERE}:role/lambda-cloudtrail-exec
  - Memory: 128 MB
  - Timeout: 10s (adjust as necessary)

Configure the source for the function:

  - Bucket: cloudtrail.example.com (use your actual bucket name)
  - Invocation Role:  arn:aws:iam::{YOUR\_AWS\_ACCOUNT\_NUMBER\_HERE}:role/lambda-cloudtrail-invoke

## License
    Copyright (c) 2014, RetailNext Inc.
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are met:
      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
      * Neither the name of RetailNext Inc. nor the names of its contributors
        may be used to endorse or promote products derived from this software
        without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
    ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
    WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
    DISCLAIMED. IN NO EVENT SHALL RETAILNEXT INC. BE LIABLE FOR ANY
    DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
    (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
    ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
    SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
