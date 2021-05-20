import * as Mongoose from 'quickmongo'

const db = new Mongoose.Database('MONGOOSEURL')

db.once('ready', async () => {
    return console.log('Database Ready!')
})

function setCommandData(guildID, commandID, commandContent, commandEphemeral, commandForked) {
    return db.set(`${guildID}.${commandID}`, {
        content: commandContent,
        ephemeral: commandEphemeral,
        forked: commandForked
    })
}

export {
    db,
    setCommandData
}