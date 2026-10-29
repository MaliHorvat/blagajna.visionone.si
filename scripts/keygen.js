#!/usr/bin/env node
'use strict';
const crypto = require('crypto');
console.log('SESSION_SECRET=' + crypto.randomBytes(32).toString('base64url'));
console.log('SETUP_TOKEN=' + crypto.randomBytes(18).toString('base64url'));
