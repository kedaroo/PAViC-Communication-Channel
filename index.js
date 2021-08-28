const express = require("express");
const app = express();
const server = require("http").createServer(app);
// connecting to socket.io server
const io = require("socket.io")(server);
let port = process.env.PORT || 3000;

// connecting to postgres sql on heroku
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://ornadhmtjwkgpc:1710749e9a24e2a97f3c23dd7ee4244b57216c585f409992e8c65d6bae181dcc@ec2-35-153-91-18.compute-1.amazonaws.com:5432/d3t6h6goqj9e1g',
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect();

var blockSize = 0;

io.on('connection', socket => {

    console.log('A user connected: ' + socket.id);

    socket.on("user_registration", userData => {
      console.log(userData)
      client.query(
        `insert into dummy_users (name, user_id, picture, mobile) values ($1, $2, $3, $4);`,
        [userData[0].name, userData[0].sub, userData[0].picture, userData[1]],
        (err, res) => {
          // if (err) throw err;
          if (err) {
            console.log(err)
          } else {
            console.log('New User SUCESSFULLY registered: ', userData[0].name)
            io.emit("add new user", [userData[0].name, userData[0].sub, userData[0].picture, userData[1]]);
          }
          // io.emit("add new block", args);
          // console.log(args)
        }
      )
    });

    socket.on("fetch users", count => {
      console.log('FETCH USERS request received from USER: ', socket.id)
      console.log('TOTAL USERS FETCHED: ', count)

      if (count >= 0) {
        console.log('FETCHING USERS...')
        client.query(`SELECT * FROM dummy_users WHERE id > ${count};`, (err, res) => {
          if (err) throw err;
          io.to(socket.id).emit("update users", {data: res.rows});
          console.log('USERS SENT:')
          console.log({data: res.rows})
        });
      }      
    })

    socket.on("fetch blocks", count => {
      console.log('FETCH BLOCKS request received from USER: ', socket.id)
      console.log('TOTAL BLOCKS FETCHED: ', count)

      if (count > 0) {
        console.log('FETCHING BLOCKS...')
        client.query(`SELECT * FROM blocks WHERE id > ${count};`, (err, res) => {
          if (err) throw err;
          io.to(socket.id).emit("update blocks", {data: res.rows});
          console.log('BLOCKS SENT:')
          console.log({data: res.rows})
        });

        // console.log('FETCHING TRANSACTIONS...')
        // client.query(`SELECT b_id, from_add, to_add, amount FROM transactions WHERE b_id > ${count};`, (err, res) => {
        //   if (err) throw err;
        //   io.to(socket.id).emit("update transactions", {data: res.rows});
        //   console.log('TRANSACTIONS SENT:')
        //   console.log({data: res.rows})
        // });
      }      
    })

    socket.on("fetch transactions", count => {
      console.log('FETCH TRANSACTIONS request received from USER: ', socket.id)
      console.log('TOTAL TRANSACTIONS FETCHED: ', count)
      console.log('HELOSSSSSSSSSSSSSSSSSSSSSS')

      if (count >= 0) {
        // console.log('FETCHING BLOCKS...')
        // client.query(`SELECT * FROM blocks2 WHERE id > ${count};`, (err, res) => {
        //   if (err) throw err;
        //   io.to(socket.id).emit("update blocks", {data: res.rows});
        //   console.log('BLOCKS SENT:')
        //   console.log({data: res.rows})
        // });

        console.log('FETCHING TRANSACTIONS...')
        // client.query(`SELECT b_id, from_add, to_add, amount FROM transactions WHERE b_id > ${count};`, (err, res) => {
          client.query(`SELECT b_id, from_add, to_add, amount FROM transactions2 WHERE id > ${count};`, (err, res) => {
          if (err) throw err;
          io.to(socket.id).emit("update transactions", {data: res.rows});
          console.log('TRANSACTIONS SENT:')
          console.log({data: res.rows})
        });
      }      
    })

    socket.on("fetch pending transactions", (callback) => {
      console.log('FETCH PENDING TRANSACTIONS request received from user: ', socket.id)
      if (blockSize == 0) {
        console.log('FIRST MINER: ', socket.id)  
        client.query('SELECT from_add, to_add, amount FROM pending_transactions2;', (err, res) => {
            if (err) throw err;
            console.log('Number of transactions sent: ', res.rowCount)
            blockSize = res.rowCount;
            io.to(socket.id).emit("pending transactions", {data: res.rows});
            console.log('PENDING TRANSACTIONS SENT:')
            console.log({data: res.rows})
        })
      } else {
          console.log('NOT FIRST MINER: ', socket.id)
          client.query('SELECT from_add, to_add, amount FROM pending_transactions2 ORDER BY id LIMIT $1;', [blockSize], (err, res) => { // removed desc limit
            if (err) throw err;
            console.log('Number of transactions sent: ', res.rowCount)
            io.to(socket.id).emit("pending transactions", {data: res.rows});
            console.log('PENDING TRANSACTIONS SENT:')
            console.log({data: res.rows})
          })
        }
    })

    socket.on("block mined", (args) => {
      var prev_hash = '';
      console.log('BLOCK MINED by: ', socket.id)
      console.log(args)
      console.log([args[1], args[2]])

      console.log('CHECKING IF THE BLOCK IS PREVIOUSLY MINED')
      client.query(
        'select prev_hash from blocks order by id desc limit 1;',
        (err, res) => {
          if (err) throw err;
          console.log('RES: ', res.rows[0].prev_hash, socket.id)
          // console.log(res.rows[0].prev_hash)
          prev_hash = res.rows[0].prev_hash
          console.log("===========================================")
          console.log(res.rows[0].prev_hash, typeof res.rows[0].prev_hash)
          console.log(args[0], typeof args[0])
          console.log("===========================================")
          if (prev_hash == args[0]) {
            console.log('The block has been mined already')
          } else {
            console.log('You are the first one to mine')
            console.log('NEW BLOCK INSERTED ON SERVER SIDE')
            client.query(
              'INSERT INTO blocks (prev_hash, hash, nonce) VALUES ((SELECT hash FROM blocks ORDER BY id DESC LIMIT 1), $1, $2);',
              [args[1], args[2]],
              (err, res) => {
                if (err) throw err;
                console.log('ADD NEW BLOCK event emitted')
                io.emit("add new block", [args[1], args[2]]);
                console.log(args)
              }
            )
            
            client.query(
              'SELECT * FROM pending_transactions2 limit $1;',
              [blockSize],
              (err, res) => {
                if (err) throw err;
                console.log('ADD NEW TRANSACTIONS event emitted')
                io.emit("add new transactions", {data: res.rows});
                console.log({data: res.rows})
              }
            )

            console.log('TRANSACTIONS ADDED ON SERVER SIDE')
            client.query(
              'INSERT INTO transactions2 (b_id, from_add, to_add, amount) SELECT b.id, t.from_add, t.to_add, t.amount FROM blocks b CROSS JOIN pending_transactions2 t WHERE b.id = (SELECT id FROM blocks ORDER BY id DESC LIMIT 1) LIMIT $1;',
              [blockSize],
              (err, res) => {
                if (err) throw err;
              }
            )

            console.log('MINING REWARD TRANSACTION ADDED ON SERVER SIDE')
            client.query(
              // 'INSERT INTO transactions2 (b_id, from_add, to_add, amount) SELECT b.id, t.from_add, t.to_add, t.amount FROM blocks b CROSS JOIN pending_transactions2 t WHERE b.id = (SELECT id FROM blocks ORDER BY id DESC LIMIT 1) LIMIT $1;',
              'INSERT INTO transactions2 (b_id, from_add, to_add, amount) VALUES ((select b_id from transactions2 order by id desc limit 1), $1, $2, $3);',
              args[3],
              (err, res) => {
                if (err) throw err;
              }
            )

            client.query(
              'SELECT * FROM transactions2 order by id desc limit 1;',
              (err, res) => {
                if (err) throw err;
                console.log('ADD NEW TRANSACTIONS event emitted')
                io.emit("add new transactions", {data: res.rows});
                console.log({data: res.rows})
              }
            )

            console.log('PENDING_TRANSACTIONS cleared')
            client.query(
              'DELETE FROM pending_transactions2 WHERE id IN (SELECT id FROM pending_transactions2 ORDER BY id LIMIT $1);',
              [blockSize],
              (err, res) => {
                if (err) throw err;
              }
            )

            console.log('BLOCKSIZE set to 0 again')
            blockSize = 0;
                }
              }
            )
    })


    socket.on("transaction", transaction => {
      console.log('NEW TRANSACTION received from: ', socket.id)
      console.log('NEW TRANSACTION received: ', transaction)
      const from = parseInt(transaction.from)
      const to = parseInt(transaction.to)
      const amount = parseInt(transaction.amount)

      client.query(
        'SELECT mobile FROM dummy_users where mobile = $1;',
        [to],
        (err, res) => {
          if (res.rowCount == 1) {
            io.to(socket.id).emit("transaction acknowledgement", {message: 'Transaction added successfully'});
            console.log(res.rowCount)
            console.log(res)
            client.query('INSERT INTO pending_transactions2 (from_add, to_add, amount) VALUES ($1, $2, $3);', [from, to, amount], (err, res) => {
              if (err) throw err;
              for (let row of res.rows) {
                  console.log(JSON.stringify(row));
              }
            });
          } else {
            console.log(res)
            io.to(socket.id).emit("transaction acknowledgement", {message: 'The user does not exist'});
          }
        }
      )

      // client.query('INSERT INTO pending_transactions2 (from_add, to_add, amount) VALUES ($1, $2, $3);', abc, (err, res) => {
      //   if (err) throw err;
      //   for (let row of res.rows) {
      //       console.log(JSON.stringify(row));
      //   }
      // });
    });

    socket.on("disconnect", (reason) => {
        console.log('USER DISCONNECTED: ' + socket.id);
        console.log('REASON: ', reason)
    });

    socket.on("connect_error", (err) => {
        console.log(`connect_error due to ${err.message}`);
    });
});

server.listen(port, () => console.log('server running on port: ' + port));