import sharp from 'sharp';
import jsQR from 'jsqr';
import { downloadQuotedMedia } from '../src/features/media.js';
export default {
  name:'scanqr',aliases:[],ownerOnly:true,requiresAllowedChat:true,requiresAI:false,feature:'utility',
  async execute({raw,reply}){const media=await downloadQuotedMedia(raw);if(media.kind!=='image')throw new Error('Reply to an image containing a QR code.');const {data,info}=await sharp(media.buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});const code=jsQR(new Uint8ClampedArray(data),info.width,info.height);if(!code?.data)throw new Error('No QR code found in that image.');await reply(code.data);return{text:code.data};}
};
