// index.js
require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  EmbedBuilder
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const PREFIX = '!';
const COMMANDS_CHANNEL_ID = process.env.COMMANDS_CHANNEL_ID;
const APPROVER_CHANNEL_ID = process.env.APPROVER_CHANNEL_ID;
const PUBLIC_CHANNEL_ID = process.env.PUBLIC_CHANNEL_ID;

// State for post-creation
const dmStates     = new Map();
const pending      = new Map();

// State for Roblox tracking
const trackedPlayers = new Map();
// trackedPlayers: Map<playerId, { totalSeconds, lastWasInGame, lastCheck, interval }>

const URL_REGEX = /(https?:\/\/[^\s]+)/;

// ——————————————————————————————
// Entry point
// ——————————————————————————————
client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

// ——————————————————————————————
// Message handling: !post, !track, !stoptrack, and DM flow
// ——————————————————————————————
client.on(Events.MessageCreate, async msg => {
  if (msg.author.bot) return;

  // 1) In-guild "!post" command
  if (
    msg.guild &&
    msg.content === `${PREFIX}post` &&
    msg.channelId === COMMANDS_CHANNEL_ID
  ) {
    const dm = await msg.author.createDM();
    dmStates.set(msg.author.id, { step: 'category' });

    const categories = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('post_category')
        .setPlaceholder('Select a category…')
        .addOptions([
          { label: 'Looking for Devs',      value: 'Looking for Devs' },
          { label: 'For Hire',              value: 'For Hire' },
          { label: 'Sell Creations',        value: 'Sell Creations' },
          { label: 'Roblox Advertising',    value: 'Roblox Advertising' },
          { label: 'Looking for Investors', value: 'Looking for Investors' },
          { label: 'Looking for Services',  value: 'Looking for Services' }
        ])
    );
    return dm.send({
      content: '🛠 **New Post** – select a category:',
      components: [categories]
    });
  }

  // 2) Tracking commands: !track and !stoptrack
  const [cmd, arg] = msg.content.trim().split(/\s+/);
  if (cmd === `${PREFIX}track` && arg) {
    const playerId = arg;
    if (trackedPlayers.has(playerId)) {
      return msg.reply(`🔄 Already tracking **${playerId}**.`);
    }

    // initialize
    trackedPlayers.set(playerId, {
      totalSeconds: 0,
      lastWasInGame: false,
      lastCheck: Date.now(),
      interval: null
    });
    await msg.reply(`🎮 Started tracking **${playerId}**.`);

    // every 10 seconds, fetch presence and update
    const interval = setInterval(async () => {
      try {
        const state = trackedPlayers.get(playerId);
        const now   = Date.now();
        const inGame = await isPlayerInGame(playerId);

        if (inGame) {
          if (!state.lastWasInGame) state.lastCheck = now;
          state.totalSeconds += (now - state.lastCheck) / 1000;
        }
        state.lastWasInGame = inGame;
        state.lastCheck     = now;

        const h = Math.floor(state.totalSeconds / 3600);
        const m = Math.floor((state.totalSeconds % 3600) / 60);
        const s = Math.floor(state.totalSeconds % 60);
        const timeStr = `${h}h ${m}m ${s}s`;

        const chan = await client.channels.fetch(APPROVER_CHANNEL_ID);
        await chan.send(`⏱ Player **${playerId}** total in-game time: **${timeStr}**`);
      } catch (err) {
        console.error('Tracking error:', err);
      }
    }, 10_000);

    trackedPlayers.get(playerId).interval = interval;
    return;
  }

  if (cmd === `${PREFIX}stoptrack` && arg) {
    const playerId = arg;
    const state = trackedPlayers.get(playerId);
    if (!state) {
      return msg.reply(`❌ Not tracking **${playerId}**.`);
    }
    clearInterval(state.interval);
    trackedPlayers.delete(playerId);
    return msg.reply(`🛑 Stopped tracking **${playerId}**.`);
  }

  // 3) DM flow for post creation
  if (!msg.guild && dmStates.has(msg.author.id)) {
    const state = dmStates.get(msg.author.id);

    // Editing mode
    if (state.step === 'editing') {
      switch (state.editField) {
        case 'title':       state.title         = msg.content.trim(); break;
        case 'description': state.description   = msg.content.trim(); break;
        case 'payment':     state.paymentAmount = msg.content.trim(); break;
      }
      return previewPost(msg.author.id, msg.channel);
    }

    // Standard steps: title → description → payment selection → amount/reference
    if (state.step === 'title') {
      state.title = msg.content.trim();
      state.step  = 'description';
      return msg.channel.send('✏️ Please enter the **description** of your post:');
    }
    if (state.step === 'description') {
      state.description = msg.content.trim();
      if (state.category === 'Roblox Advertising') {
        return previewPost(msg.author.id, msg.channel);
      }
      state.step = 'paymentMethod';
      return msg.channel.send({
        content: '💳 Select a **payment method**:',
        components: [new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('payment_method')
            .setPlaceholder('Choose method…')
            .addOptions([
              { label: 'Robux',             value: 'Robux' },
              { label: 'PayPal',            value: 'PayPal' },
              { label: 'Percentage of Rev', value: 'Revenue%' },
              { label: 'Bank Transfer',     value: 'Bank' },
              { label: 'Bitcoin',           value: 'Bitcoin' },
              { label: 'Discord Nitro',     value: 'Nitro' }
            ])
        )]
      });
    }
    if (state.step === 'paymentAmount') {
      state.paymentAmount = msg.content.trim();
      if (['For Hire','Sell Creations'].includes(state.category)) {
        state.step = 'reference';
        return msg.channel.send('🔗 Provide a **link** or **attach an image** for reference:');
      }
      if (state.category === 'Looking for Investors') {
        state.paymentOccurrence = 'Upfront';
        return previewPost(msg.author.id, msg.channel);
      }
      return previewPost(msg.author.id, msg.channel);
    }
    if (state.step === 'reference') {
      if (!msg.attachments.size && !URL_REGEX.test(msg.content)) {
        return msg.channel.send('⚠️ You must send a valid link or attach an image.');
      }
      state.reference = msg.attachments.size
        ? msg.attachments.first().url
        : msg.content.trim();
      return previewPost(msg.author.id, msg.channel);
    }
  }
});

// ——————————————————————————————
// InteractionCreate: paste your existing select-menu & button handler here
// ——————————————————————————————

// ——————————————————————————————
// Helpers for post flow
// ——————————————————————————————
async function previewPost(userId, dmChannel) {
  const state = dmStates.get(userId);
  state.step = 'preview';
  const embed = buildApprovalEmbed(state, await client.users.fetch(userId));
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('edit_post').setLabel('✏️ Edit').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('send_post').setLabel('✅ Send').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('cancel_post').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
  );
  await dmChannel.send({ content: '📝 **Preview your post:**', embeds: [embed], components: [row] });
}

async function sendForApproval(userId) {
  const state = dmStates.get(userId);
  const dm    = await client.users.fetch(userId).then(u => u.createDM());
  const embed = buildApprovalEmbed(state, await client.users.fetch(userId));
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('approve_post').setLabel('✅ Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('reject_post').setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
  );
  const chan = await client.channels.fetch(APPROVER_CHANNEL_ID);
  const msg  = await chan.send({ embeds: [embed], components: [buttons] });
  pending.set(msg.id, { ...state, userId });
  await dm.send('✅ Your post has been sent for approval!');
  dmStates.delete(userId);
}

function buildApprovalEmbed(data, user) {
  const fields = [
    { name: 'Category', value: data.category, inline: true },
    ...(data.serviceType ? [{ name: 'Service', value: data.serviceType, inline: true }] : []),
    ...(data.paymentMethod
      ? [
          { name: 'Method',  value: data.paymentMethod, inline: true },
          { name: 'Timing',  value: data.paymentOccurrence, inline: true },
          { name: 'Amount',  value: data.paymentAmount,   inline: true }
        ]
      : []),
    ...(data.reference ? [{ name: 'Reference', value: data.reference, inline: false }] : [])
  ];
  return new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .addFields(fields)
    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
    .setTimestamp();
}

// ——————————————————————————————
// Presence helper: POST to /v1/presence/users
// ——————————————————————————————
async function isPlayerInGame(playerId) {
  const url = 'https://presence.roproxy.com/v1/presence/users';
  console.log(`[Tracker] POST → ${url} { userIds: [${playerId}] }`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds: [Number(playerId)] })
  });
  if (!res.ok) {
    throw new Error(`Presence API returned HTTP ${res.status}`);
  }
  const data = await res.json();
  // data.userPresences is an array of objects
  if (!Array.isArray(data.userPresences) || data.userPresences.length === 0) {
    throw new Error('No presence data returned');
  }
  const me = data.userPresences.find(u => String(u.userId) === String(playerId));
  if (!me) throw new Error('User not found in presence data');
  console.log(`[Tracker] presenceType for ${playerId} → ${me.userPresenceType}`);
  // Roblox’s legacy: userPresenceType===2 means InGame
  return me.userPresenceType === 2;
}

// ——————————————————————————————
client.login(process.env.TOKEN);
