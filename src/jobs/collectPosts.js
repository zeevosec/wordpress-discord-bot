const { Op } = require('sequelize');
const { isUrl } = require('../utils');
const { Job } = require('.');

const isValidMessage = (message) => {
  return !message.author.bot && isUrl(message.content);
};

class CollectPostsJob extends Job {
  constructor({ interval, database, logger, client, name = 'CollectPostsJob' }) {
    super({ interval, database, logger, client, name });
    this.interval = interval;
    this.database = database;
    this.logger = logger;
    this.client = client;
  }

  async run() {
    this.log('Collecting posts...');
    const { Post } = this.database;
    const channels = this.client.channels.cache.filter((channel) => {
      return channel.type === 'text' && channel.name.toLowerCase() !== 'general';
    });

    /* eslint-disable */
    for (const chl of channels.array()) {
      const channel = await chl.fetch();
      try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const content = messages.filter(isValidMessage);
        for (const ct of content.array()) {
          const { author } = ct;
          const post = await Post.findAll({
            where: {
              [Op.or]: [
                {
                  discordId: {
                    [Op.eq]: ct.id,
                  },
                },
                {
                  url: {
                    [Op.eq]: ct.content,
                  },
                },
              ],
            },
          });
          if (!post.length) {
            this.log(`Found new message ${ct.content}`);
            await Post.create({
              content: ct.content,
              url: ct.content,
              discordId: ct.id,
              authorDiscordUsername: author.username,
              authorDiscordDiscriminator: author.discriminator,
              authorDiscordId: author.id,
              createdTimestamp: ct.createdTimestamp,
              channelDiscordId: channel.id,
              channelDiscordName: channel.name,
            });
          }
        }
      } catch (e) {
        this.log('Something went wrong fetching messages');
      }
    }
  }
}

module.exports = CollectPostsJob;
