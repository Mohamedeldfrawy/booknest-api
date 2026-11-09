import  'dotenv/config'
import app from './app.js'
import {db} from './config/database.js'

const port = process.env.PORT || 3000

async function startServer() {
  try {

      await db()
      app.listen(port, () => console.log(`Example app listening on port ${port}!`))
  }catch(error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }

}
startServer()