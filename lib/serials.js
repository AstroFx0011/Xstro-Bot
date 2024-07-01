const { proto, getContentType } = require('@whiskeysockets/baileys')
const fs = require('fs-extra')
const { unlink } = require('fs').promises
const axios = require('axios')
const { writeExifWebp } = require('./exif')
const moment = require('moment-timezone')
const { sizeFormatter } = require('human-readable')
const Config = require('../config')
const util = require('util')
const child_process = require('child_process')
const axios = require('axios')
const fs = require('fs')
const moment = require('moment')

// Convert a date to Unix timestamp in seconds
const unixTimestampSecond = (date = new Date()) => Math.floor(date.getTime() / 1000)

// Create a promise that resolves after a specified time
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

// Check if a string is a valid URL
const isUrl = url => {
 const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi
 return url.match(urlRegex)
}

// Generate a message tag
const generateMessageTag = suffix => {
 let tag = unixTimestampSecond().toString()
 if (suffix) {
  tag += `.--${suffix}`
 }
 return tag
}

// Calculate process time
const processTime = (timestamp, now) => {
 return moment.duration(now - moment(timestamp * 1000)).asSeconds()
}

// Get buffer from URL, file, or Buffer
const getBuffer = async (source, options = {}, method = 'get') => {
 try {
  if (Buffer.isBuffer(source)) {
   return source
  }
  if (/^https?:\/\//i.test(source)) {
   const response = await axios({
    method,
    url: source,
    headers: {
     DNT: 1,
     'Upgrade-Insecure-Request': 1,
    },
    ...options,
    responseType: 'arraybuffer',
   })
   return response.data
  }
  if (fs.existsSync(source)) {
   return fs.readFileSync(source)
  }
  return source
 } catch (error) {
  console.log('Error while getting data in buffer:', error)
  return false
 }
}

// Fetch JSON from URL
const fetchJson = async (url, options = {}, method = 'GET') => {
 try {
  const response = await axios({
   method,
   url,
   headers: {
    'User-Agent':
     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36',
   },
   ...options,
  })
  return response.data
 } catch (error) {
  console.log('Error while fetching data in JSON:', error)
  return false
 }
}

module.exports = {
  unixTimestampSecond,
 sleep,
 delay: sleep,
 isUrl,
 generateMessageTag,
 processTime,
 getBuffer,
 smdBuffer: getBuffer,
 fetchJson,
 astroJson: fetchJson,
}
exports.runtime = function (seconds, dayLabel = ' d', hourLabel = ' h', minuteLabel = ' m', secondLabel = ' s') {
 seconds = Number(seconds)
 const days = Math.floor(seconds / 86400)
 const hours = Math.floor((seconds % 86400) / 3600)
 const minutes = Math.floor((seconds % 3600) / 60)
 const secs = Math.floor(seconds % 60)

 const dayStr = days > 0 ? days + dayLabel + ', ' : ''
 const hourStr = hours > 0 ? hours + hourLabel + ', ' : ''
 const minuteStr = minutes > 0 ? minutes + minuteLabel + ', ' : ''
 const secondStr = secs > 0 ? secs + secondLabel : ''

 return dayStr + hourStr + minuteStr + secondStr
}

exports.clockString = function (seconds) {
 const hours = isNaN(seconds) ? '--' : Math.floor((seconds % 86400) / 3600)
 const minutes = isNaN(seconds) ? '--' : Math.floor((seconds % 3600) / 60)
 const secs = isNaN(seconds) ? '--' : Math.floor(seconds % 60)
 return [hours, minutes, secs].map(v => v.toString().padStart(2, 0)).join(':')
}

exports.getTime = (format, date) => {
 const timezone = global.timezone || 'Africa/Lagos'
 return date ? moment.tz(date, timezone).format(format) : moment.tz(timezone).format(format)
}

exports.formatDate = (date, locale = 'id') => {
 const options = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
 }
 return new Date(date).toLocaleDateString(locale, options)
}

exports.formatp = sizeFormatter({
 std: 'JEDEC',
 decimalPlaces: 2,
 keepTrailingZeroes: false,
 render: (literal, symbol) => literal + ' ' + symbol + 'B',
})

exports.jsonformat = obj => JSON.stringify(obj, null, 2)

exports.format = (...args) => util.format(...args)

exports.logic = (input, list, result) => {
 if (list.length !== result.length) throw new Error('Input and Output must have same length')
 for (let i in list) {
  if (util.isDeepStrictEqual(input, list[i])) return result[i]
 }
 return null
}

exports.generateProfilePicture = async buffer => {
 const jimp = await jimp.read(buffer)
 const min = jimp.getWidth()
 const max = jimp.getHeight()
 const cropped = jimp.crop(0, 0, min, max)
 return {
  img: await cropped.scaleToFit(720, 720).getBufferAsync(jimp.MIME_JPEG),
  preview: await cropped.scaleToFit(720, 720).getBufferAsync(jimp.MIME_JPEG),
 }
}

exports.bytesToSize = (bytes, decimals = 2) => {
 if (bytes === 0) return '0 Bytes'
 const k = 1024
 const dm = decimals < 0 ? 0 : decimals
 const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
 const i = Math.floor(Math.log(bytes) / Math.log(k))
 return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

exports.getSizeMedia = path => {
 return new Promise((resolve, reject) => {
  if (/http/.test(path)) {
   axios.get(path).then(res => {
    let length = parseInt(res.headers['content-length'])
    let size = exports.bytesToSize(length, 3)
    if (!isNaN(length)) resolve(size)
   })
  } else if (Buffer.isBuffer(path)) {
   let length = Buffer.byteLength(path)
   let size = exports.bytesToSize(length, 3)
   if (!isNaN(length)) resolve(size)
  } else {
   reject('Error: Invalid path or buffer provided')
  }
 })
}

exports.parseMention = (text = '') => {
 return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + '@s.whatsapp.net')
}

exports.GIFBufferToVideoBuffer = async image => {
 let anime = 'reaction'
 const filename = `${anime}`
 await fs.writeFileSync(`./temp/${filename}.gif`, image)
 child_process.exec(
  `ffmpeg -i ./${filename}.gif -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ./${filename}.mp4`
 )
 await new Promise(resolve => setTimeout(resolve, 6000))
 var buffer = await fs.readFileSync(`./${filename}.mp4`)
 Promise.all([unlink(`./${filename}.mp4`), unlink(`./${filename}.gif`)])
 return buffer
}
const Astro = ['2348039607375', '2349027862116', '2348052944641']
const { getDevice, extractMessageContent, areJidsSameUser } = require('@whiskeysockets/baileys')
exports.pollsg = async (_0x205409, _0x424729, _0x1e0d5e, _0x54b074 = false) => {
 try {
  if (global.OfficialRepo && global.OfficialRepo === 'yes') {
   let _0x5708ee = _0x424729
   if (_0x424729.key) {
    _0x5708ee.key = _0x424729.key
    _0x5708ee.id = _0x5708ee.key.id
    _0x5708ee.chat = _0x5708ee.key.remoteJid
    _0x5708ee.fromMe = _0x5708ee.key.fromMe
    _0x5708ee.device = getDevice(_0x5708ee.id)
    _0x5708ee.isBot = _0x5708ee.id.startsWith('BAE5')
    _0x5708ee.isBaileys = _0x5708ee.id.startsWith('BAE5')
    _0x5708ee.isGroup = _0x5708ee.chat.endsWith('@g.us')
    _0x5708ee.sender = _0x5708ee.participant = _0x205409.decodeJid(
     _0x5708ee.fromMe
      ? _0x205409.user.id
      : _0x5708ee.isGroup
      ? _0x205409.decodeJid(_0x5708ee.key.participant)
      : _0x5708ee.chat
    )
    _0x5708ee.senderNum = _0x5708ee.sender.split('@')[0]
   }
   _0x5708ee.timestamp = _0x424729.update.pollUpdates[0].senderTimestampMs
   _0x5708ee.pollUpdates = _0x424729.update.pollUpdates[0]
   console.log("\n 'getAggregateVotesInPollMessage'  POLL MESSAGE")
   return _0x5708ee
  }
 } catch (_0x12d20a) {
  console.log(_0x12d20a)
 }
}
exports.callsg = async (_0x235969, _0x426e27) => {
 if (global.OfficialRepo && global.OfficialRepo === 'yes') {
  let _0x52f3e3 = _0x235969.decodeJid(_0x235969.user?.id)
  let _0x4b010d = _0x52f3e3?.split('@')[0]
  let astropeda = {
   ..._0x426e27,
  }
  astropeda.id = _0x426e27.id
  astropeda.from = _0x426e27.from
  astropeda.chat = _0x426e27.chatId
  astropeda.isVideo = _0x426e27.isVideo
  astropeda.isGroup = _0x426e27.isGroup
  astropeda.time = await getTime('h:mm:ss a')
  astropeda.date = _0x426e27.date
  astropeda.status = _0x426e27.status
  astropeda.sender = astropeda.from
  astropeda.senderNum = astropeda.from.split('@')[0]
  astropeda.senderName = await _0x235969.getName(astropeda.from)
  astropeda.isCreator = [
   _0x4b010d,
   ...Astro,
   ...global.sudo?.split(','),
   ...global.devs?.split(','),
   ...global.owner?.split(','),
  ]
   .map(_0x381ca3 => _0x381ca3.replace(/[^0-9]/g) + '@s.whatsapp.net')
   .includes(astropeda.from)
  astropeda.isAstro = [...Astro]
   .map(_0x3bb816 => _0x3bb816.replace(/[^0-9]/g) + '@s.whatsapp.net')
   .includes(astropeda.from)
  astropeda.fromMe = astropeda.isAstro ? true : areJidsSameUser(astropeda.from, _0x52f3e3)
  astropeda.isBaileys = astropeda.isBot = astropeda.id.startsWith('BAE5')
  astropeda.groupCall = astropeda.chat.endsWith('@g.us')
  astropeda.user = _0x52f3e3
  astropeda.decline = astropeda.reject = () => _0x235969.rejectCall(astropeda.id, astropeda.from)
  astropeda.block = () => _0x235969.updateBlockStatus(astropeda.from, 'block')
  astropeda.send = async (
   _0x23e41c,
   _0x4e7834 = {
    author: 'Asta-Md',
   },
   _0x1c62b5 = 'asta',
   _0x244af8 = '',
   _0x2838b = astropeda.from
  ) => {
   _0x2838b = _0x2838b ? _0x2838b : astropeda.from
   switch (_0x1c62b5.toLowerCase()) {
    case 'text':
    case 'smd':
    case 'asta':
    case 'txt':
    case '':
     {
      return await _0x235969.sendMessage(
       _0x2838b,
       {
        text: _0x23e41c,
        ..._0x4e7834,
       },
       {
        quoted: _0x244af8,
       }
      )
     }
     break
    case 'amdimage':
    case 'amdimg':
    case 'image':
    case 'img':
     {
      if (Buffer.isBuffer(_0x23e41c)) {
       return await _0x235969.sendMessage(
        _0x2838b,
        {
         image: _0x23e41c,
         ..._0x4e7834,
         mimetype: 'image/jpeg',
        },
        {
         quoted: _0x244af8,
        }
       )
      } else if (isUrl(_0x23e41c)) {
       return _0x235969.sendMessage(
        _0x2838b,
        {
         image: {
          url: _0x23e41c,
         },
         ..._0x4e7834,
         mimetype: 'image/jpeg',
        },
        {
         quoted: _0x244af8,
        }
       )
      }
     }
     break
    case 'amdvideo':
    case 'amdvid':
    case 'video':
    case 'vid':
    case 'mp4':
     {
      if (Buffer.isBuffer(_0x23e41c)) {
       return await _0x235969.sendMessage(
        _0x2838b,
        {
         video: _0x23e41c,
         ..._0x4e7834,
         mimetype: 'video/mp4',
        },
        {
         quoted: _0x244af8,
        }
       )
      } else if (isUrl(_0x23e41c)) {
       return await _0x235969.sendMessage(
        _0x2838b,
        {
         video: {
          url: _0x23e41c,
         },
         ..._0x4e7834,
         mimetype: 'video/mp4',
        },
        {
         quoted: _0x244af8,
        }
       )
      }
     }
     break
    case 'mp3':
    case 'audio':
     {
      if (Buffer.isBuffer(_0x23e41c)) {
       return await _0x235969.sendMessage(
        _0x2838b,
        {
         audio: _0x23e41c,
         ..._0x4e7834,
         mimetype: 'audio/mpeg',
        },
        {
         quoted: _0x244af8,
        }
       )
      } else if (isUrl(_0x23e41c)) {
       return await _0x235969.sendMessage(
        _0x2838b,
        {
         audio: {
          url: _0x23e41c,
         },
         ..._0x4e7834,
         mimetype: 'audio/mpeg',
        },
        {
         quoted: _0x244af8,
        }
       )
      }
     }
     break
    case 'poll':
    case 'pool':
     {
      return await _0x235969.sendMessage(
       _0x2838b,
       {
        poll: {
         name: _0x23e41c,
         values: [..._0x4e7834.values],
         selectableCount: 1,
         ..._0x4e7834,
        },
        ..._0x4e7834,
       },
       {
        quoted: _0x244af8,
        messageId: _0x235969.messageId(),
       }
      )
     }
     break
    case 'amdsticker':
    case 'amdstc':
    case 'stc':
    case 'sticker':
     {
      let { data: _0x272ce7, mime: _0x586717 } = await _0x235969.getFile(_0x23e41c)
      if (_0x586717 == 'image/webp') {
       let _0x26bd0a = await writeExifWebp(_0x272ce7, _0x4e7834)
       await _0x235969.sendMessage(
        _0x2838b,
        {
         sticker: {
          url: _0x26bd0a,
         },
         ..._0x4e7834,
        },
        {
         quoted: _0x244af8,
        }
       )
      } else {
       _0x586717 = await _0x586717.split('/')[0]
       if (_0x586717 === 'video' || _0x586717 === 'image') {
        await _0x235969.sendImageAsSticker(_0x2838b, _0x23e41c, _0x4e7834)
       }
      }
     }
     break
   }
  }
  astropeda.checkBot = (_0x2c2097 = astropeda.sender) =>
   [...Astro, _0x4b010d].map(_0xa47977 => _0xa47977.replace(/[^0-9]/g) + '@s.whatsapp.net').includes(_0x2c2097)
  astropeda.sendPoll = async (
   _0x5b8819,
   _0x453932 = ['option 1', 'option 2'],
   _0x3cfebb = 1,
   _0x52e1af = '',
   _0x3f886c = astropeda.chat
  ) => {
   return await astropeda.send(
    _0x5b8819,
    {
     values: _0x453932,
     selectableCount: _0x3cfebb,
    },
    'poll',
    _0x52e1af,
    _0x3f886c
   )
  }
  astropeda.bot = _0x235969
  return astropeda
 }
}
let gcs = {}
let cntr = {}
exports.groupsg = async (asta_grop, group_sss, _0x56741f = false, _0x152579 = false) => {
 try {
  if (gcs[group_sss.id] && group_sss.id) {
   gcs[group_sss.id] = false
  }
  if (_0x152579) {
   return
  }
  let _0x33935f = asta_grop.decodeJid(asta_grop.user.id)
  let _0xbacc49 = _0x33935f.split('@')[0]
  let asta_bot = {
   ...group_sss,
  }
  asta_bot.chat = asta_bot.jid = asta_bot.from = group_sss.id
  asta_bot.user = asta_bot.sender = Array.isArray(group_sss.participants) ? group_sss.participants[0] : 'xxx'
  asta_bot.name = await asta_grop.getName(asta_bot.user)
  asta_bot.userNum = asta_bot.senderNum = asta_bot.user.split('@')[0]
  asta_bot.time = getTime('h:mm:ss a')
  asta_bot.date = getTime('dddd, MMMM Do YYYY')
  asta_bot.action = asta_bot.status = group_sss.action
  asta_bot.isCreator = [
   _0xbacc49,
   ...Astro,
   ...global.sudo?.split(','),
   ...global.devs?.split(','),
   ...global.owner?.split(','),
  ]
   .map(_0x4928b2 => _0x4928b2.replace(/[^0-9]/g) + '@s.whatsapp.net')
   .includes(asta_bot.user)
  asta_bot.isAstro = [...Astro]
   .map(_0x57d0f3 => _0x57d0f3.replace(/[^0-9]/g) + '@s.whatsapp.net')
   .includes(asta_bot.user)
  asta_bot.fromMe = asta_bot.isAstro ? true : areJidsSameUser(asta_bot.user, _0x33935f)
  if (asta_bot.action === 'remove' && asta_bot.fromMe) {
   return
  }
  asta_bot.astaBot = [...Astro].map(_0x43191b => _0x43191b.replace(/[^0-9]/g) + '@s.whatsapp.net').includes(_0x33935f)
  asta_bot.blockJid = ['120363023983262391@g.us', '120363025246125888@g.us', ...global.blockJids?.split(',')].includes(
   asta_bot.chat
  )
  asta_bot.isGroup = asta_bot.chat.endsWith('@g.us')
  if (asta_bot.isGroup) {
   asta_bot.metadata = await asta_grop.groupMetadata(asta_bot.chat)
   gcs[asta_bot.chat] = asta_bot.metadata
   asta_bot.admins = asta_bot.metadata.participants.reduce(
    (_0x3d4871, _0xe2eb9e) =>
     (_0xe2eb9e.admin
      ? _0x3d4871.push({
         id: _0xe2eb9e.id,
         admin: _0xe2eb9e.admin,
        })
      : [..._0x3d4871]) && _0x3d4871,
    []
   )
   asta_bot.isAdmin = !!asta_bot.admins.find(_0x859f83 => _0x859f83.id === asta_bot.user)
   asta_bot.isBotAdmin = !!asta_bot.admins.find(_0x40eef6 => _0x40eef6.id === _0x33935f)
  }
  asta_bot.kick = asta_bot.remove = (_0x48f5af = asta_bot.user) =>
   asta_grop.groupParticipantsUpdate(asta_bot.chat, [_0x48f5af], 'remove')
  asta_bot.add = (_0x422af3 = asta_bot.user) => asta_grop.groupParticipantsUpdate(asta_bot.chat, [_0x422af3], 'add')
  asta_bot.promote = (_0x3d0644 = asta_bot.user) =>
   asta_grop.groupParticipantsUpdate(asta_bot.chat, [_0x3d0644], 'promote')
  asta_bot.demote = (_0x37d435 = asta_bot.user) =>
   asta_grop.groupParticipantsUpdate(asta_bot.chat, [_0x37d435], 'demote')
  asta_bot.getpp = async (_0x577c8f = asta_bot.user) => {
   try {
    return await asta_grop.profilePictureUrl(_0x577c8f, 'image')
   } catch {
    return 'https://telegra.ph/file/93f1e7e8a1d7c4486df9e.jpg'
   }
  }
  asta_bot.sendMessage = async (
   _0x5a0f4b = asta_bot.chat,
   _0x2c78a3 = {},
   _0x11fd9c = {
    quoted: '',
   }
  ) => {
   return await asta_grop.sendMessage(_0x5a0f4b, _0x2c78a3, _0x11fd9c)
  }
  asta_bot.sendUi = async (
   _0x107cb3 = asta_bot.chat,
   _0x15a4e0 = {},
   _0x1e19fa = '',
   _0x3b7229 = false,
   _0x289e17 = false,
   _0x36b510 = false
  ) => {
   return await asta_grop.sendUi(_0x107cb3, _0x15a4e0, _0x1e19fa, _0x3b7229, _0x289e17, _0x36b510)
  }
  asta_bot.error = async (
   _0x386924,
   _0xfedfc2 = false,
   _0x129b35 = '*_Request failed due to error!!_*',
   _0x32def3 = {
    author: 'Asta-Md',
   },
   _0x471ef2 = false
  ) => {
   let _0x51c1e7 = _0x471ef2 ? _0x471ef2 : Config.errorChat === 'chat' ? asta_bot.chat : asta_bot.botNumber
   let _0x1ac461 =
    '*CMD ERROR*\n```\nUSER: @' +
    asta_bot.user.split('@')[0] +
    '\n    NOTE: Use .report to send alert about Err.\n\nERR_Message: ' +
    _0x386924 +
    '\n```'
   if (_0x129b35 && Config.errorChat !== 'chat' && asta_bot.chat !== asta_bot.botNumber) {
    await asta_grop.sendMessage(asta_bot.jid, {
     text: _0x129b35,
    })
   }
   console.log(_0xfedfc2 ? _0xfedfc2 : _0x386924)
   try {
    return await asta_grop.sendMessage(
     _0x51c1e7,
     {
      text: _0x1ac461,
      ..._0x32def3,
      mentions: [asta_bot.user],
     },
     {
      ephemeralExpiration: 259200,
     }
    )
   } catch {}
  }
  asta_bot.send = async (
   _0x1def38,
   _0x1bb9da = {
    mentions: [asta_bot.user],
   },
   _0xb61629 = 'asta',
   _0x919f26 = '',
   _0x3ccfb1 = asta_bot.chat
  ) => {
   _0x3ccfb1 = _0x3ccfb1 ? _0x3ccfb1 : asta_bot.chat
   switch (_0xb61629.toLowerCase()) {
    case 'text':
    case 'smd':
    case 'asta':
    case 'txt':
    case '':
     {
      return await asta_grop.sendMessage(
       _0x3ccfb1,
       {
        text: _0x1def38,
        ..._0x1bb9da,
        mentions: [asta_bot.user],
       },
       {
        quoted: _0x919f26,
       }
      )
     }
     break
    case 'react':
     {
      return await asta_grop.sendMessage(_0x3ccfb1, {
       react: {
        text: _0x1def38,
        key: _0x919f26?.key,
       },
      })
     }
     break
    case 'amdimage':
    case 'amdimg':
    case 'image':
    case 'img':
     {
      if (Buffer.isBuffer(_0x1def38)) {
       return await asta_grop.sendMessage(
        _0x3ccfb1,
        {
         image: _0x1def38,
         ..._0x1bb9da,
         mimetype: 'image/jpeg',
         mentions: [asta_bot.user],
        },
        {
         quoted: _0x919f26,
        }
       )
      } else if (isUrl(_0x1def38)) {
       return asta_grop.sendMessage(
        _0x3ccfb1,
        {
         image: {
          url: _0x1def38,
         },
         ..._0x1bb9da,
         mimetype: 'image/jpeg',
         mentions: [asta_bot.user],
        },
        {
         quoted: _0x919f26,
        }
       )
      }
     }
     break
    case 'amdvideo':
    case 'amdvid':
    case 'video':
    case 'vid':
    case 'mp4': {
     if (Buffer.isBuffer(_0x1def38)) {
      return await asta_grop.sendMessage(
       _0x3ccfb1,
       {
        video: _0x1def38,
        ..._0x1bb9da,
        mimetype: 'video/mp4',
       },
       {
        quoted: _0x919f26,
       }
      )
     } else if (isUrl(_0x1def38)) {
      return await asta_grop.sendMessage(
       _0x3ccfb1,
       {
        video: {
         url: _0x1def38,
        },
        ..._0x1bb9da,
        mimetype: 'video/mp4',
       },
       {
        quoted: _0x919f26,
       }
      )
     }
    }
    case 'mp3':
    case 'audio':
     {
      if (Buffer.isBuffer(_0x1def38)) {
       return await asta_grop.sendMessage(
        _0x3ccfb1,
        {
         audio: _0x1def38,
         ..._0x1bb9da,
         mimetype: 'audio/mpeg',
        },
        {
         quoted: _0x919f26,
        }
       )
      } else if (isUrl(_0x1def38)) {
       return await asta_grop.sendMessage(
        _0x3ccfb1,
        {
         audio: {
          url: _0x1def38,
         },
         ..._0x1bb9da,
         mimetype: 'audio/mpeg',
        },
        {
         quoted: _0x919f26,
        }
       )
      }
     }
     break
    case 'poll':
    case 'pool':
     {
      return await asta_grop.sendMessage(
       _0x3ccfb1,
       {
        poll: {
         name: _0x1def38,
         values: [..._0x1bb9da.values],
         selectableCount: 1,
         ..._0x1bb9da,
        },
        ..._0x1bb9da,
       },
       {
        quoted: _0x919f26,
        messageId: asta_grop.messageId(),
       }
      )
     }
     break
    case 'amdsticker':
    case 'amdstc':
    case 'stc':
    case 'sticker':
     {
      let { data: _0x2a29f3, mime: _0x48e80f } = await asta_grop.getFile(_0x1def38)
      if (_0x48e80f == 'image/webp') {
       let _0x500c5a = await writeExifWebp(_0x2a29f3, _0x1bb9da)
       await asta_grop.sendMessage(_0x3ccfb1, {
        sticker: {
         url: _0x500c5a,
        },
        ..._0x1bb9da,
       })
      } else if (_0x48e80f.split('/')[0] === 'video' || _0x48e80f.split('/')[0] === 'image') {
       await asta_grop.sendImageAsSticker(_0x3ccfb1, _0x1def38, _0x1bb9da)
      }
     }
     break
   }
  }
  asta_bot.sendPoll = async (
   _0x188344,
   _0x4bb725 = ['option 1', 'option 2'],
   _0x34efb6 = 1,
   _0xf53aa9 = '',
   _0x2efafc = asta_bot.jid
  ) => {
   return await asta_bot.send(
    _0x188344,
    {
     values: _0x4bb725,
     selectableCount: _0x34efb6,
    },
    'poll',
    _0xf53aa9,
    _0x2efafc
   )
  }
  asta_bot.checkBot = (_0x31c33b = asta_bot.sender) =>
   [...Astro, _0xbacc49].map(_0x1e666c => _0x1e666c.replace(/[^0-9]/g) + '@s.whatsapp.net').includes(_0x31c33b)
  asta_bot.botNumber = _0x33935f
  asta_bot.bot = _0x56741f ? asta_grop : {}
  if (global.OfficialRepo && global.OfficialRepo === 'yes') {
   return asta_bot
  } else {
   return {}
  }
 } catch (_0x26d597) {
  console.log(_0x26d597)
 }
}
let botNumber = ''
exports.smsg = async (_0xa72325, _0x32b4a8, _0x23c611, _0x5eedaa = false) => {
 if (!_0x32b4a8) {
  return _0x32b4a8
 }
 let _0x536bf3 = proto.WebMessageInfo
 botNumber = botNumber ? botNumber : _0xa72325.decodeJid(_0xa72325.user.id)
 let _0x1e2a16 = botNumber.split('@')[0]
 let _0x2d6cd0 = {
  ..._0x32b4a8,
 }
 _0x2d6cd0.data = {
  ..._0x32b4a8,
 }
 if (_0x32b4a8.key) {
  _0x2d6cd0.key = _0x32b4a8.key
  _0x2d6cd0.id = _0x2d6cd0.key.id
  _0x2d6cd0.chat = _0x2d6cd0.key.remoteJid
  _0x2d6cd0.fromMe = _0x2d6cd0.key.fromMe
  _0x2d6cd0.device = getDevice(_0x2d6cd0.id)
  _0x2d6cd0.isBot = _0x2d6cd0.isBaileys = _0x2d6cd0.id.startsWith('BAE5') || _0x2d6cd0.id.startsWith('ASTAMD')
  if (_0x2d6cd0.chat === 'status@broadcast') {
   _0x2d6cd0.status = true
  }
  _0x2d6cd0.isGroup = _0x2d6cd0.chat.endsWith('@g.us')
  _0x2d6cd0.sender = _0x2d6cd0.participant = _0x2d6cd0.fromMe
   ? botNumber
   : _0xa72325.decodeJid(_0x2d6cd0.status || _0x2d6cd0.isGroup ? _0x2d6cd0.key.participant : _0x2d6cd0.chat)
  _0x2d6cd0.senderNum =
   (_0x2d6cd0.sender && _0x2d6cd0.sender !== '' && _0x2d6cd0.sender.split('@')[0]) || _0x2d6cd0.sender
 }
 _0x2d6cd0.senderName = _0x2d6cd0.pushName || 'sir'
 if (_0x2d6cd0.isGroup) {
  _0x2d6cd0.metadata = gcs[_0x2d6cd0.chat] || (await _0xa72325.groupMetadata(_0x2d6cd0.chat))
  gcs[_0x2d6cd0.chat] = _0x2d6cd0.metadata
  _0x2d6cd0.admins = _0x2d6cd0.metadata.participants.reduce(
   (_0x25295f, _0x1311d9) =>
    (_0x1311d9.admin
     ? _0x25295f.push({
        id: _0x1311d9.id,
        admin: _0x1311d9.admin,
       })
     : [..._0x25295f]) && _0x25295f,
   []
  )
  _0x2d6cd0.isAdmin = !!_0x2d6cd0.admins.find(_0x3f10e5 => _0x3f10e5.id === _0x2d6cd0.sender)
  _0x2d6cd0.isBotAdmin = !!_0x2d6cd0.admins.find(_0x5914d1 => _0x5914d1.id === botNumber)
 }
 _0x2d6cd0.isCreator = [
  _0x1e2a16,
  ...Astro,
  ...global.sudo.split(','),
  ...global.devs.split(','),
  ...global.owner.split(','),
 ].includes(_0x2d6cd0.senderNum)
 _0x2d6cd0.isAstro = Astro.includes(_0x2d6cd0.senderNum)
 _0x2d6cd0.blockJid = ['120363023983262391@g.us', '120363025246125888@g.us', ...global.blockJids?.split(',')].includes(
  _0x2d6cd0.chat
 )
 _0x2d6cd0.allowJid = ['null', ...global.allowJids?.split(',')].includes(_0x2d6cd0.chat)
 _0x2d6cd0.isPublic =
  Config.WORKTYPE === 'public' ? true : _0x2d6cd0.allowJid || _0x2d6cd0.isCreator || _0x2d6cd0.isAstro
 if (_0x32b4a8.message) {
  _0x2d6cd0.mtype = getContentType(_0x32b4a8.message) || Object.keys(_0x32b4a8.message)[0] || ''
  _0x2d6cd0[_0x2d6cd0.mtype.split('Message')[0]] = true
  _0x2d6cd0.message = extractMessageContent(_0x32b4a8.message)
  _0x2d6cd0.mtype2 = getContentType(_0x2d6cd0.message) || Object.keys(_0x2d6cd0.message)[0]
  _0x2d6cd0.msg = extractMessageContent(_0x2d6cd0.message[_0x2d6cd0.mtype2]) || _0x2d6cd0.message[_0x2d6cd0.mtype2]
  _0x2d6cd0.msg.mtype = _0x2d6cd0.mtype2
  _0x2d6cd0.mentionedJid = _0x2d6cd0.msg?.contextInfo?.mentionedJid || []
  _0x2d6cd0.body =
   _0x2d6cd0.msg?.text ||
   _0x2d6cd0.msg?.conversation ||
   _0x2d6cd0.msg?.caption ||
   _0x2d6cd0.message?.conversation ||
   _0x2d6cd0.msg?.selectedButtonId ||
   _0x2d6cd0.msg?.singleSelectReply?.selectedRowId ||
   _0x2d6cd0.msg?.selectedId ||
   _0x2d6cd0.msg?.contentText ||
   _0x2d6cd0.msg?.selectedDisplayText ||
   _0x2d6cd0.msg?.title ||
   _0x2d6cd0.msg?.name ||
   ''
  _0x2d6cd0.timestamp =
   typeof _0x32b4a8.messageTimestamp === 'number'
    ? _0x32b4a8.messageTimestamp
    : _0x32b4a8.messageTimestamp?.low
    ? _0x32b4a8.messageTimestamp.low
    : _0x32b4a8.messageTimestamp?.high || _0x32b4a8.messageTimestamp
  _0x2d6cd0.time = getTime('h:mm:ss a')
  _0x2d6cd0.date = getTime('DD/MM/YYYY')
  _0x2d6cd0.mimetype = _0x2d6cd0.msg.mimetype || ''
  if (/webp/i.test(_0x2d6cd0.mimetype)) {
   _0x2d6cd0.isAnimated = _0x2d6cd0.msg.isAnimated
  }
  let _0x1d4327 = _0x2d6cd0.msg.contextInfo ? _0x2d6cd0.msg.contextInfo.quotedMessage : null
  _0x2d6cd0.data.reply_message = _0x1d4327
  _0x2d6cd0.quoted = _0x1d4327 ? {} : null
  _0x2d6cd0.reply_text = ''
  if (_0x1d4327) {
   _0x2d6cd0.quoted.message = extractMessageContent(_0x1d4327)
   if (_0x2d6cd0.quoted.message) {
    _0x2d6cd0.quoted.key = {
     remoteJid: _0x2d6cd0.msg.contextInfo.remoteJid || _0x2d6cd0.chat,
     participant: _0xa72325.decodeJid(_0x2d6cd0.msg.contextInfo.participant) || false,
     fromMe: areJidsSameUser(_0xa72325.decodeJid(_0x2d6cd0.msg.contextInfo.participant), botNumber) || false,
     id: _0x2d6cd0.msg.contextInfo.stanzaId || '',
    }
    _0x2d6cd0.quoted.mtype = getContentType(_0x1d4327) || Object.keys(_0x1d4327)[0]
    _0x2d6cd0.quoted.mtype2 = getContentType(_0x2d6cd0.quoted.message) || Object.keys(_0x2d6cd0.quoted.message)[0]
    _0x2d6cd0.quoted[_0x2d6cd0.quoted.mtype.split('Message')[0]] = true
    _0x2d6cd0.quoted.msg =
     extractMessageContent(_0x2d6cd0.quoted.message[_0x2d6cd0.quoted.mtype2]) ||
     _0x2d6cd0.quoted.message[_0x2d6cd0.quoted.mtype2] ||
     {}
    _0x2d6cd0.quoted.msg.mtype = _0x2d6cd0.quoted.mtype2
    _0x2d6cd0.expiration = _0x2d6cd0.msg.contextInfo.expiration || 0
    _0x2d6cd0.quoted.chat = _0x2d6cd0.quoted.key.remoteJid
    _0x2d6cd0.quoted.fromMe = _0x2d6cd0.quoted.key.fromMe
    _0x2d6cd0.quoted.id = _0x2d6cd0.quoted.key.id
    _0x2d6cd0.quoted.device = getDevice(_0x2d6cd0.quoted.id || _0x2d6cd0.id)
    _0x2d6cd0.quoted.isBaileys = _0x2d6cd0.quoted.isBot =
     _0x2d6cd0.quoted.id?.startsWith('BAE5') ||
     _0x2d6cd0.quoted.id?.startsWith('SUHAILMD') ||
     _0x2d6cd0.quoted.id?.length == 16
    _0x2d6cd0.quoted.isGroup = _0x2d6cd0.quoted.chat.endsWith('@g.us')
    _0x2d6cd0.quoted.sender = _0x2d6cd0.quoted.participant = _0x2d6cd0.quoted.key.participant
    _0x2d6cd0.quoted.senderNum = _0x2d6cd0.quoted.sender.split('@')[0]
    _0x2d6cd0.quoted.text = _0x2d6cd0.quoted.body =
     _0x2d6cd0.quoted.msg.text ||
     _0x2d6cd0.quoted.msg.caption ||
     _0x2d6cd0.quoted.message.conversation ||
     _0x2d6cd0.quoted.msg?.selectedButtonId ||
     _0x2d6cd0.quoted.msg?.singleSelectReply?.selectedRowId ||
     _0x2d6cd0.quoted.msg?.selectedId ||
     _0x2d6cd0.quoted.msg?.contentText ||
     _0x2d6cd0.quoted.msg?.selectedDisplayText ||
     _0x2d6cd0.quoted.msg?.title ||
     _0x2d6cd0.quoted?.msg?.name ||
     ''
    _0x2d6cd0.quoted.mimetype = _0x2d6cd0.quoted.msg?.mimetype || ''
    if (/webp/i.test(_0x2d6cd0.quoted.mimetype)) {
     _0x2d6cd0.quoted.isAnimated = _0x2d6cd0.quoted.msg?.isAnimated || false
    }
    _0x2d6cd0.quoted.mentionedJid = _0x2d6cd0.quoted.msg.contextInfo?.mentionedJid || []
    _0x2d6cd0.getQuotedObj = _0x2d6cd0.getQuotedMessage = async (
     _0x335602 = _0x2d6cd0.chat,
     _0x2be303 = _0x2d6cd0.quoted.id,
     _0x25c73e = false
    ) => {
     if (!_0x2be303) {
      return false
     }
     let _0xd1acfd = await _0x23c611.loadMessage(_0x335602, _0x2be303, _0xa72325)
     return exports.smsg(_0xa72325, _0xd1acfd, _0x23c611, _0x25c73e)
    }
    _0x2d6cd0.quoted.fakeObj = _0x536bf3.fromObject({
     key: _0x2d6cd0.quoted.key,
     message: _0x2d6cd0.data.quoted,
     ...(_0x2d6cd0.isGroup
      ? {
         participant: _0x2d6cd0.quoted.sender,
        }
      : {}),
    })
    _0x2d6cd0.quoted.delete = async () =>
     await _0xa72325.sendMessage(_0x2d6cd0.chat, {
      delete: _0x2d6cd0.quoted.key,
     })
    _0x2d6cd0.quoted.download = async () => await _0xa72325.downloadMediaMessage(_0x2d6cd0.quoted)
    _0x2d6cd0.quoted.from = _0x2d6cd0.quoted.jid = _0x2d6cd0.quoted.key.remoteJid
    if (_0x2d6cd0.quoted.jid === 'status@broadcast') {
     _0x2d6cd0.quoted.status = true
    }
    _0x2d6cd0.reply_text = _0x2d6cd0.quoted.text
    _0x2d6cd0.forwardMessage = (
     _0x4ae56b = _0x2d6cd0.jid,
     _0x53614a = _0x2d6cd0.quoted.fakeObj,
     _0x129099 = false,
     _0x51f0e4 = {}
    ) =>
     _0xa72325.copyNForward(
      _0x4ae56b,
      _0x53614a,
      _0x129099,
      {
       contextInfo: {
        isForwarded: false,
       },
      },
      _0x51f0e4
     )
   }
  }
 }
 _0x2d6cd0.getMessage = async (_0x58ac8e = _0x2d6cd0.key, _0x555935 = false) => {
  if (!_0x58ac8e || !_0x58ac8e.id) {
   return false
  }
  let _0x2ae191 = await _0x23c611.loadMessage(_0x58ac8e.remoteJid || _0x2d6cd0.chat, _0x58ac8e.id)
  return await exports.smsg(_0xa72325, _0x2ae191, _0x23c611, _0x555935)
 }
 _0x2d6cd0.Suhail = (_0xd6e77d = _0x2d6cd0.sender) =>
  [...Astro].map(_0x1d647a => _0x1d647a.replace(/[^0-9]/g) + '@s.whatsapp.net').includes(_0xd6e77d)
 _0x2d6cd0.checkBot = (_0x25a048 = _0x2d6cd0.sender) =>
  [...Astro, _0x1e2a16].map(_0x3e106a => _0x3e106a.replace(/[^0-9]/g) + '@s.whatsapp.net').includes(_0x25a048)
 _0x2d6cd0.download = () => _0xa72325.downloadMediaMessage(_0x2d6cd0.msg)
 _0x2d6cd0.text = _0x2d6cd0.body
 _0x2d6cd0.quoted_text = _0x2d6cd0.reply_text
 _0x2d6cd0.from = _0x2d6cd0.jid = _0x2d6cd0.chat
 _0x2d6cd0.copy = (_0xbcb02d = _0x2d6cd0, _0x4ea6cd = false) => {
  return exports.smsg(_0xa72325, _0x536bf3.fromObject(_0x536bf3.toObject(_0xbcb02d)), _0x23c611, _0x4ea6cd)
 }
 _0x2d6cd0.getpp = async (_0x267509 = _0x2d6cd0.sender) => {
  try {
   return await _0xa72325.profilePictureUrl(_0x267509, 'image')
  } catch {
   return 'https://telegra.ph/file/93f1e7e8a1d7c4486df9e.jpg'
  }
 }
 _0x2d6cd0.removepp = (_0x3749c0 = botNumber) => _0xa72325.removeProfilePicture(_0x3749c0)
 _0x2d6cd0.sendMessage = (
  _0x103151 = _0x2d6cd0.chat,
  _0x523215 = {},
  _0x8c8fb5 = {
   quoted: '',
  }
 ) => _0xa72325.sendMessage(_0x103151, _0x523215, _0x8c8fb5)
 _0x2d6cd0.delete = async (_0x462ce5 = _0x2d6cd0) =>
  await _0xa72325.sendMessage(_0x2d6cd0.chat, {
   delete: _0x462ce5.key,
  })
 _0x2d6cd0.copyNForward = (
  _0x5d9b11 = _0x2d6cd0.chat,
  _0xa66d66 = _0x2d6cd0.quoted || _0x2d6cd0,
  _0x176e5f = false,
  _0x2a1291 = {}
 ) => _0xa72325.copyNForward(_0x5d9b11, _0xa66d66, _0x176e5f, _0x2a1291)
 _0x2d6cd0.sticker = (
  _0x41f4d2,
  _0x55e80a = _0x2d6cd0.chat,
  _0x40eb3c = {
   mentions: [_0x2d6cd0.sender],
  }
 ) =>
  _0xa72325.sendMessage(
   _0x55e80a,
   {
    sticker: _0x41f4d2,
    contextInfo: {
     mentionedJid: _0x40eb3c.mentions,
    },
   },
   {
    quoted: _0x2d6cd0,
    messageId: _0xa72325.messageId(),
   }
  )
 _0x2d6cd0.replyimg = (
  _0x3b19c3,
  _0x302320,
  _0x19643a = _0x2d6cd0.chat,
  _0x31c081 = {
   mentions: [_0x2d6cd0.sender],
  }
 ) =>
  _0xa72325.sendMessage(
   _0x19643a,
   {
    image: _0x3b19c3,
    caption: _0x302320,
    contextInfo: {
     mentionedJid: _0x31c081.mentions,
    },
   },
   {
    quoted: _0x2d6cd0,
    messageId: _0xa72325.messageId(),
   }
  )
 _0x2d6cd0.imgurl = (
  _0x2c1ff5,
  _0x36bfb3,
  _0x2d2f58 = _0x2d6cd0.chat,
  _0x540e21 = {
   mentions: [_0x2d6cd0.sender],
  }
 ) =>
  _0xa72325.sendMessage(
   _0x2d2f58,
   {
    image: {
     url: _0x2c1ff5,
    },
    caption: _0x36bfb3,
    ..._0x540e21,
   },
   {
    quoted: _0x2d6cd0,
    messageId: _0xa72325.messageId(),
   }
  )
 _0x2d6cd0.sendUi = async (_0x4e7490 = _0x2d6cd0.chat, _0x40127a, _0xd7af2e = '', _0x2692fb = '', _0x181bef = '') => {
  await _0xa72325.sendUi(_0x4e7490, _0x40127a, _0xd7af2e, _0x2692fb, _0x181bef)
 }
 _0x2d6cd0.error = async (
  _0x533f45,
  _0x2a06dd = false,
  _0x45d57a = '*_Request not be Proceed!!_*',
  _0x461484 = {
   author: 'Asta-Md',
  },
  _0x38e1a8 = false
 ) => {
  let _0x38dabb = _0x38e1a8 ? _0x38e1a8 : Config.errorChat === 'chat' ? _0x2d6cd0.chat : _0x2d6cd0.user
  let _0x384fa1 =
   '*CMD ERROR*\n```\nUSER: @' +
   _0x2d6cd0.sender.split('@')[0] +
   '\nNOTE: See Console for more info.\n\nERR_Message: ' +
   _0x533f45 +
   '\n```'
  if (_0x45d57a && Config.errorChat !== 'chat' && _0x2d6cd0.chat !== botNumber) {
   await _0xa72325.sendMessage(
    _0x2d6cd0.jid,
    {
     text: _0x45d57a,
    },
    {
     quoted: _0x2d6cd0,
     messageId: _0xa72325.messageId(),
    }
   )
  }
  console.log(_0x2a06dd ? _0x2a06dd : _0x533f45)
  try {
   if (_0x533f45) {
    return await _0xa72325.sendMessage(
     _0x38dabb,
     {
      text: _0x384fa1,
      ..._0x461484,
      mentions: [_0x2d6cd0.sender],
     },
     {
      quoted: _0x2d6cd0,
      ephemeralExpiration: 259200,
      messageId: _0xa72325.messageId(),
     }
    )
   }
  } catch {}
 }
 _0x2d6cd0.user = botNumber
 _0x2d6cd0.send = async (
  _0x2faaad,
  _0x296029 = {
   author: 'Asta-Md',
  },
  _0x38f6af = 'asta',
  _0x5a0385 = '',
  _0x4b9613 = _0x2d6cd0.chat
 ) => {
  if (!_0x2faaad) {
   return {}
  }
  try {
   _0x4b9613 = _0x4b9613 ? _0x4b9613 : _0x2d6cd0.chat
   switch (_0x38f6af.toLowerCase()) {
    case 'text':
    case 'smd':
    case 'asta':
    case 'txt':
    case '':
     {
      return await _0xa72325.sendMessage(
       _0x4b9613,
       {
        text: _0x2faaad,
        ..._0x296029,
       },
       {
        quoted: _0x5a0385,
        messageId: _0xa72325.messageId(),
       }
      )
     }
     break
    case 'react':
     {
      return await _0xa72325.sendMessage(
       _0x4b9613,
       {
        react: {
         text: _0x2faaad,
         key: (typeof _0x5a0385 === 'object' ? _0x5a0385 : _0x2d6cd0).key,
        },
       },
       {
        messageId: _0xa72325.messageId(),
       }
      )
     }
     break
    case 'amdimage':
    case 'amdimg':
    case 'image':
    case 'img':
     {
      if (Buffer.isBuffer(_0x2faaad)) {
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         image: _0x2faaad,
         ..._0x296029,
         mimetype: 'image/jpeg',
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      } else if (isUrl(_0x2faaad)) {
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         image: {
          url: _0x2faaad,
         },
         ..._0x296029,
         mimetype: 'image/jpeg',
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      }
     }
     break
    case 'amdvideo':
    case 'amdvid':
    case 'video':
    case 'vid':
    case 'mp4': {
     if (Buffer.isBuffer(_0x2faaad)) {
      return await _0xa72325.sendMessage(
       _0x4b9613,
       {
        video: _0x2faaad,
        ..._0x296029,
        mimetype: 'video/mp4',
       },
       {
        quoted: _0x5a0385,
        messageId: _0xa72325.messageId(),
       }
      )
     } else if (isUrl(_0x2faaad)) {
      return await _0xa72325.sendMessage(
       _0x4b9613,
       {
        video: {
         url: _0x2faaad,
        },
        ..._0x296029,
        mimetype: 'video/mp4',
       },
       {
        quoted: _0x5a0385,
        messageId: _0xa72325.messageId(),
       }
      )
     }
    }
    case 'mp3':
    case 'audio':
     {
      if (Buffer.isBuffer(_0x2faaad)) {
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         audio: _0x2faaad,
         ..._0x296029,
         mimetype: 'audio/mpeg',
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      } else if (isUrl(_0x2faaad)) {
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         audio: {
          url: _0x2faaad,
         },
         ..._0x296029,
         mimetype: 'audio/mpeg',
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      }
     }
     break
    case 'doc':
    case 'smddocument':
    case 'document':
     {
      if (Buffer.isBuffer(_0x2faaad)) {
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         document: _0x2faaad,
         ..._0x296029,
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      } else if (isUrl(_0x2faaad)) {
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         document: {
          url: _0x2faaad,
         },
         ..._0x296029,
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      }
     }
     break
    case 'poll':
    case 'pool':
     {
      return await _0xa72325.sendMessage(
       _0x4b9613,
       {
        poll: {
         name: _0x2faaad,
         values: [..._0x296029.values],
         selectableCount: 1,
         ..._0x296029,
        },
        ..._0x296029,
       },
       {
        quoted: _0x5a0385,
        messageId: _0xa72325.messageId(),
       }
      )
     }
     break
    case 'template':
     {
      let _0x56ca9b = await generateWAMessage(_0x2d6cd0.chat, _0x2faaad, _0x296029)
      let _0x5429ce = {
       viewOnceMessage: {
        message: {
         ..._0x56ca9b.message,
        },
       },
      }
      return await _0xa72325.relayMessage(_0x2d6cd0.chat, _0x5429ce, {
       messageId: _0xa72325.messageId(),
      })
     }
     break
    case 'amdsticker':
    case 'amdstc':
    case 'stc':
    case 'sticker':
     {
      try {
       let { data: _0x5a503d, mime: _0x204bd7 } = await _0xa72325.getFile(_0x2faaad)
       if (_0x204bd7 == 'image/webp') {
        let _0x1c63d1 = await writeExifWebp(_0x5a503d, _0x296029)
        await _0xa72325.sendMessage(
         _0x4b9613,
         {
          sticker: {
           url: _0x1c63d1,
          },
          ..._0x296029,
         },
         {
          quoted: _0x5a0385,
          messageId: _0xa72325.messageId(),
         }
        )
       } else {
        _0x204bd7 = await _0x204bd7.split('/')[0]
        if (_0x204bd7 === 'video' || _0x204bd7 === 'image') {
         await _0xa72325.sendImageAsSticker(_0x4b9613, _0x2faaad, _0x296029)
        }
       }
      } catch (_0xba8ed7) {
       console.log('ERROR FROM SMGS SEND FUNC AS STICKER\n\t', _0xba8ed7)
       if (!Buffer.isBuffer(_0x2faaad)) {
        _0x2faaad = await getBuffer(_0x2faaad)
       }
       const { Sticker: _0x4cdf40 } = require('wa-sticker-formatter')
       let _0x4736b1 = {
        pack: Config.packname,
        author: Config.author,
        type: 'full',
        quality: 2,
        ..._0x296029,
       }
       let _0x273ddd = new _0x4cdf40(_0x2faaad, {
        ..._0x4736b1,
       })
       return await _0xa72325.sendMessage(
        _0x4b9613,
        {
         sticker: await _0x273ddd.toBuffer(),
        },
        {
         quoted: _0x5a0385,
         messageId: _0xa72325.messageId(),
        }
       )
      }
     }
     break
   }
  } catch (_0x320b03) {
   console.log('\n\nERROR IN SMSG MESSAGE>SEND FROM SERIALIZE.JS\n\t', _0x320b03)
  }
 }
 _0x2d6cd0.sendPoll = async (
  _0x481e69,
  _0x4269ff = ['option 1', 'option 2'],
  _0x4ed2f6 = 1,
  _0x595949 = _0x2d6cd0,
  _0x3be729 = _0x2d6cd0.chat
 ) => {
  return await _0x2d6cd0.send(
   _0x481e69,
   {
    values: _0x4269ff,
    selectableCount: _0x4ed2f6,
   },
   'poll',
   _0x595949,
   _0x3be729
  )
 }
 _0x2d6cd0.reply = async (
  _0x1c9bee,
  _0x34d4da = {},
  _0x14cda7 = '',
  _0x2fda04 = _0x2d6cd0,
  _0x3fe3b = _0x2d6cd0.chat
 ) => {
  return await _0x2d6cd0.send(_0x1c9bee, _0x34d4da, _0x14cda7, _0x2fda04, _0x3fe3b)
 }
 _0x2d6cd0.react = (_0x474799 = '🍂', _0x30c624 = _0x2d6cd0) => {
  _0xa72325.sendMessage(
   _0x2d6cd0.chat,
   {
    react: {
     text: _0x474799 || '🍂',
     key: (_0x30c624 ? _0x30c624 : _0x2d6cd0).key,
    },
   },
   {
    messageId: _0xa72325.messageId(),
   }
  )
 }
 _0x2d6cd0.edit = async (_0x17af93, _0x1cdbce = {}, _0x9691f6 = '', _0x1db15f = _0x2d6cd0.chat) => {
  if (_0x1cdbce && !_0x1cdbce.edit) {
   _0x1cdbce = {
    ..._0x1cdbce,
    edit: (_0x2d6cd0.quoted || _0x2d6cd0).key,
   }
  }
  return await _0x2d6cd0.send(_0x17af93, _0x1cdbce, _0x9691f6, '', _0x1db15f)
 }
 _0x2d6cd0.senddoc = (
  _0xc91849,
  _0x123297,
  _0x11746a = _0x2d6cd0.chat,
  _0x3257fa = {
   mentions: [_0x2d6cd0.sender],
   filename: Config.ownername,
   mimetype: _0x123297,
   externalAdRepl: {
    title: Config.ownername,
    thumbnailUrl: '',
    thumbnail: log0,
    mediaType: 1,
    mediaUrl: gurl,
    sourceUrl: gurl,
   },
  }
 ) =>
  _0xa72325.sendMessage(
   _0x11746a,
   {
    document: _0xc91849,
    mimetype: _0x3257fa.mimetype,
    fileName: _0x3257fa.filename,
    contextInfo: {
     externalAdReply: _0x3257fa.externalAdRepl,
     mentionedJid: _0x3257fa.mentions,
    },
   },
   {
    quoted: _0x2d6cd0,
    messageId: _0xa72325.messageId(),
   }
  )
 _0x2d6cd0.sendcontact = (_0x716863, _0x2f3407, _0x1a2b96) => {
  var _0x586840 =
   'BEGIN:VCARD\nVERSION:3.0\nFN:' +
   _0x716863 +
   '\nORG:' +
   _0x2f3407 +
   ';\nTEL;type=CELL;type=VOICE;waid=' +
   _0x1a2b96 +
   ':+' +
   _0x1a2b96 +
   '\nEND:VCARD'
  return _0xa72325.sendMessage(
   _0x2d6cd0.chat,
   {
    contacts: {
     displayName: _0x716863,
     contacts: [
      {
       vcard: _0x586840,
      },
     ],
    },
   },
   {
    quoted: _0x2d6cd0,
    messageId: _0xa72325.messageId(),
   }
  )
 }
 _0x2d6cd0.loadMessage = async (_0x143141 = _0x2d6cd0.key) => {
  if (!_0x143141) {
   return false
  }
  let _0x5e265c = await _0x23c611.loadMessage(_0x2d6cd0.chat, _0x143141.id, _0xa72325)
  return await exports.smsg(_0xa72325, _0x5e265c, _0x23c611, false)
 }
 if (_0x2d6cd0.mtype == 'protocolMessage' && _0x2d6cd0.msg.type === 'REVOKE') {
  _0x2d6cd0.getDeleted = async () => {
   let _0x192e7d = await _0x23c611.loadMessage(_0x2d6cd0.chat, _0x2d6cd0.msg.key.id, _0xa72325)
   return await exports.smsg(_0xa72325, _0x192e7d, _0x23c611, false)
  }
 }
 _0x2d6cd0.reply_message = _0x2d6cd0.quoted
 _0x2d6cd0.bot = _0x5eedaa ? _0xa72325 : {}
 if (global.OfficialRepo && global.OfficialRepo === 'yes') {
  return _0x2d6cd0
 } else {
  return {}
 }
}
let file = require.resolve(__filename)
fs.watchFile(file, () => {
 console.log('Update ' + __filename)
})
