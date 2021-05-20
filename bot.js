import * as Discord from 'discord.js'
import {
    db,
    setCommandData
} from './database.js'

const client = new Discord.Client({
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_WEBHOOKS,
        Discord.Intents.FLAGS.GUILD_MESSAGES
    ],
    partials: ['GUILD_MEMBER']
})

const ratelimits = new Discord.Collection()

client.once('ready', async () => {
    setInterval(async () => {
        await client.guilds?.cache.forEach(g => ratelimits.delete(g.id))
    }, 3600000)

    await client.user.setStatus('idle')
    return console.log('Logged in as', client.user.tag)
})

client.on('interaction', async interaction => {
    if (!interaction.guildID) return sendError('Interaction Commands can be invoked in a guild only')
    let commands = await client.application?.commands?.fetch()

    if (commands.has(interaction.commandID)) {
        if (ratelimits.get(interaction.guildID) >= 4) return sendError(`Discord API limits reached try using this command tommorow`)
        if (!interaction.member.permissions.has('MANAGE_GUILD')) return sendError('You need the Manage Guild permission to use this Interaction Command')

        if (interaction.commandID == commands.find(c => c.name == 'create')?.id) {
            commands = await client.guilds.cache.get(interaction.guildID)?.commands?.fetch()

            if (commands.find(c => c.name == option('name'))) return sendError(`Interaction Command ${option('name')} already exists`)
            if (!/^[\w-]{1,32}$/.test(option('name'))) return sendError('Interaction Command name must not contain any special characters and must be under 32 characters')
            if (!option('description').length > 101) return sendError('Interaction Command description must be under 100 characters')
            if (!option('content').length > 1001) return sendError('Interaction Command content must be under 1000 characters')

            else {
                interaction.reply(`Interaction Command ${option('name')} was created`)

                const c = await client.guilds.cache.get(interaction.guildID)?.commands.create({
                    name: option('name'),
                    description: option('description'),
                    defaultPermission: option('default_permission', true),
                    options: [{
                        name: 'source',
                        description: 'Returns the content source of this Interaction Command (default: false)',
                        type: 5
                    }]
                })

                await setCommandData(interaction.guildID, c.id, option('content'), option('ephemeral', false), 'none').then(
                    interaction.followUp('This Interaction Command is ready to use', {
                        ephemeral: true
                    })
                )
            }
        }

        if (interaction.commandID == commands.find(c => c.name == 'patch')?.id) {
            commands = await client.guilds.cache.get(interaction.guildID)?.commands?.fetch()
            const c = commands.find(c => c.name == option('name'))

            if (!c) return sendError(`Interaction Command ${option('name')} does not exist`)
            if (commands.find(c => c.name == option('new_name', '#'))) return sendError(`Interaction Command with the name ${option('new_name')} already exists`)
            if (!/^[\w-]{1,32}$/.test(option('new_name', c.name))) return sendError('Interaction Command name must not contain any special characters and must be under 32 characters')
            if (!option('description', c.description).length > 101) return sendError('Interaction Command description must be under 100 characters')
            if (!option('content', 'SlashContent').length > 1001) return sendError('Interaction Command content must be under 1000 characters')
            else {
                interaction.reply(`Interaction Command ${option('name')} was patched`)

                await client.guilds.cache.get(interaction.guildID)?.commands.edit(c.id, {
                    name: option('new_name', c.name),
                    description: option('description', c.description),
                    defaultPermission: option('default_permission', c.defaultPermission),
                    options: [{
                        name: 'source',
                        description: 'Returns the content source of this Interaction Command (default: false)',
                        type: 5
                    }]
                })

                await setCommandData(interaction.guildID, c.id, option('content', await db.get(`${interaction.guildID}.${c.id}.content`)), option('ephemeral', await db.get(`${interaction.guildID}.${c.id}.ephemeral`))).then(
                    interaction.followUp('This Interaction Command is ready to use', {
                        ephemeral: true
                    })
                )
            }
        }

        if (interaction.commandID == commands.find(c => c.name == 'delete')?.id) {
            commands = await client.guilds.cache.get(interaction.guildID)?.commands?.fetch()
            const c = commands.find(c => c.name == option('name'))

            if (!c) return sendError(`Interaction Command ${option('name')} does not exist`)

            else {
                interaction.reply(`Interaction Command ${option('name')} was deleted`)

                await client.guilds.cache.get(interaction.guildID)?.commands.delete(c.id)

                return await db.delete(`${interaction.guildID}.${c.id}`).then(interaction.followUp('This Interaction Command was deleted', {
                    ephemeral: true
                }))
            }
        }

        if (interaction.commandID == commands.find(c => c.name == 'fork')?.id) {
            if (ratelimits.get(interaction.guildID) >= 4) return sendError(`Discord API limits reached try using this command tommorow`)
            const code = Math.round(Math.random() * 9999) + 1000
            const guild = await client.guilds.cache.get(option('guild_id', interaction.guildID))

            if (!guild) return sendError(`Guild with the ID ${option('guild_id', interaction.guildID)} does not exist`)

            commands = await guild.commands.fetch()
            const c = commands.find(c => c.name == option('name'))

            if (await (await client.guilds.cache.get(interaction.guildID).commands.fetch()).find(c => c.name == option('new_name', `fork${code}`))) return sendError(`Interction Command with the name ${option('new_name', `fork${code}`)} already exists`)
            if (!c) return sendError(`Interaction Command ${option('name')} does not exist in ${guild.name}`)
            if (!/^[\w-]{1,32}$/.test(option('new_name', `fork${code}`))) return sendError('Interaction Command name must not contain any special characters and must be under 32 characters')
            if (!option('description', c.description).length > 101) return sendError('Interaction Command description must be under 100 characters')
            if (!option('content', 'SlashContent').length > 1001) return sendError('Interaction Command content must be under 1000 characters')

            else {
                interaction.reply(`Interaction Command ${c.name} was forked as ${option('new_name', `fork${code}`)}`)

                const cmd = await client.guilds.cache.get(interaction.guildID)?.commands.create({
                    name: option('new_name', `fork${code}`),
                    description: option('description', c.description),
                    defaultPermission: option('default_permission', c.defaultPermission),
                    options: [{
                        name: 'source',
                        description: 'Returns the content source of this Interaction Command (default: false)',
                        type: 5
                    }]
                })

                return await setCommandData(interaction.guildID, cmd.id, option('content', await db.get(`${option('guild_id', interaction.guildID)}.${c.id}.content`)), option('ephemeral', await db.get(`${option('guild_id', interaction.guildID)}.${c.id}.ephemeral`)), c.id).then(
                    interaction.followUp('This Interaction Command is ready to use', {
                        ephemeral: true
                    })
                )
            }
        }

        if (interaction.commandID == commands.find(c => c.name == 'help')?.id) return interaction.reply('Visit [here](https://discord.gg/dHsVPWHM97) for help', {
            ephemeral: true
        })

    } else {
        if (!await db.has(`${interaction.guildID}.${interaction.commandID}`)) return sendError('This Interaction Command is not functional')
        else return interaction.reply(sendCommandContent(await db.get(`${interaction.guildID}.${interaction.commandID}.content`), option('source', false)), {
            ephemeral: await db.get(`${interaction.guildID}.${interaction.commandID}.ephemeral`)
        })
    }

    await ratelimits.set(parseInt(ratelimits.get(interaction.guildID)) + 1)

    function sendCommandContent(content, source) {
        if (source == true) return content
        else {
            const syntax = {
                GREET: ['Hello', 'Hi', 'Hey', 'Bonjour', 'Salut', 'Ciao', 'Namaste'][Math.round(Math.random() * 4)],
                USER_NAME: interaction.member.user.username
            }

            content = content.replace(/\b(?:GREET|USER_NAME)\b/gi, s => syntax[s])
            return content
        }
    }

    function sendError(content) {
        interaction.reply(content, {
            ephemeral: true
        })
    }

    function option(name, placeholder) {
        let result = placeholder
        if (interaction.options) {
            interaction.options.forEach(o => {
                if (o.name == name) {
                    result = o.value
                }
            })
        }
        return result
    }
})

client.on('guildCreate', async guild => {

    const c = await client.guilds.cache.get(guild.id)?.commands.create({
        name: await ['halo', 'ciao', 'bonjour', 'hello', 'hey'][Math.round(Math.random() * 4)],
        description: `Hello ${guild.name}!`,
        options: [{
            name: 'source',
            description: 'Returns the content source of this Interaction Command (default: false)',
            type: 5
        }]
    })

    return await setCommandData(guild.id, c.id, `Hey I am using ${client.user.username} to create the new Interaction Commands in my server!\nThank you [Roka's Party](https://discord.gg/V48ZxVn3KZ)`, true)
})

client.on('guildDelete', async guild => {
    await db.delete(`${guild.id}`)
})

client.login('ODQ0NDI5NjQ5Njg1NjQzMjc0.YKSSZQ.oTCQ2EGvsawEkv8Fu3t-D3GSSEo')