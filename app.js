
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');

var app = module.exports = express.createServer();


// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: '#!#$#ESARTDRSARTFH!@%)927' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

app.get('/', routes.index);

var server = app.listen(3000, function(){
  console.log("Express server listening in http://localhost:%d in %s mode", app.address().port , app.settings.env);
});

// socket ira ler o servidor
var io = require('socket.io').listen(server);

// variaveis globais para todos clientes
var users = {};
var id = -1;
var answer = '';
var shaman = '';
var shamanID = '';
var latests = Array();
//var line_history = [];
var ids = [];
var points = 10;
var ingame = false;

// no evento de conexão
io.sockets.on('connection', function(socket) {
    // Envia ele para fazer login
    socket.emit('login');

    // Quando ele efetuou login, coloca o registro nele no array global de usuários, se tiver jogo ativo fala que tem de esperar, se
    // não loga ele no jogo
    socket.on('login posted', function(data) {
        socket.nick = data.nickname;
        id ++;
        users[socket.id] =  {id : id, nick : socket.nick, score : 0, lives : 5, start : false, block : false};
        ids.push(socket.id);
        if(!ingame) {
            socket.emit('user in', {users : users});
            socket.broadcast.emit('user in', {users : users});
        } else {
            socket.emit('in game');
            socket.emit('update list', {users : users});
        }
        socket.broadcast.emit('out login', {user : users[socket.id]});

    });

    // quando o cliente desconecta do jogo, verifica se ele é o shaman ou se há mais gente no jogo, para entao encerrar ou nao o jogo,
    // e por fim envia uma mensagem prara todos dizendo que ele saiu, retirndo ele da lista global
    socket.on('disconnect', function () {
        if(shamanID == socket.id) {
            users[shamanID].score -= 10;
            socket.emit('shaman cancel', {shaman : shaman.nick});
            socket.broadcast.emit('shaman cancel', {shaman : shaman.nick});
        } else if(Object.keys(users).length - 1 <= 1) {
            socket.emit('end game');
            socket.broadcast.emit('end game');
        }
        socket.broadcast.emit('logout', {user : users[socket.id]});
        delete users[socket.id];
        ids.push(ids.indexOf(socket.id), 1);
        if(!ingame)
            socket.broadcast.emit('user in', {users : users});
        else
            socket.emit('update list', {users : users});
    });

    // Quando um usuario aperta que quer jogar, se tiver mais gente na sala e nao estiver no jogo entao altera o status dele, envia mensagem para
    // todos dizendo que ele quer jogar e olha se todos estão querendo jogar, se sim começa o jogo, se estiver em jogo entao exibe uma mensagem, o
    // mesme acontece quando ele esta sozinho no jogo
    socket.on('go game', function() {
        if(Object.keys(users).length > 1 && !ingame) {
            users[socket.id].start = true;

            socket.emit('user in', {users : users});
            socket.broadcast.emit('user in', {users : users});

            var valid = true;
            for(var index in users) {
                var user = users[index];
                if(!user.start) {
                    valid = false;
                    break;
                }
            }

            if(valid) {
                if(latests.length >= ids.length)
                    latests = [];

                do {
                    var rnd = ids[Math.floor(Math.random()*ids.length)];
                    for(var index in users) {
                        var user = users[index];
                        if(index == rnd && latests.indexOf(index) == -1) {
                            latests.push(index);
                            user.lives = 0;
                            shaman = user;
                            shaman.block = true;
                            shamanID = index;
                            break;
                        }
                    }
                }while(shaman == null || shaman == '');

                ingame = true;

                socket.emit('start game', {shaman : shaman.nick, users : users});
                socket.broadcast.emit('start game', {shaman : shaman.nick, users : users});
                io.sockets.connected[shamanID].emit('is shaman');
            }
        }
        else if(ingame)
            socket.emit('in game');
        else
            socket.emit('one player');
    });

    //  quando shaman envia a resposta certa, grava na variavel global e avisa aos outros que o jogo começou
    socket.on('answer posted', function (data) {
        answer = data.answer.toLowerCase();
        socket.broadcast.emit('open answers');
    });

   // quando inicia um traço envia a posição dele para os demais
    socket.on('init drawing', function (data) {
        socket.broadcast.emit('display init draw', {x : data.x, y : data.y});
    });

   // quando esta desenhando, envia cada posição e cor encontadas
    socket.on('drawing', function (data) {
        socket.broadcast.emit('display draw', {x : data.x, y : data.y, color : data.color});
    });

   // quando um cliente envia uma resposta, verifica se a resposta esta certa, se sim da ponto para ele e pro shaman, se nao diminui uma vida e um ponto
   // apos isso verifica se todos usuarios ja acertaram ou ja zeraram sua vida para entao começar um novo jogo
    socket.on('check answer', function (data) {
        again = data.again.toLowerCase();
        if(again == answer) {
            users[socket.id].block = true;
            users[socket.id].score += points;
            shaman.score += 5;
            var p = points;
            if(points > 5)
                points --;
            users[socket.id].lives = 0;
            users[shamanID] = shaman;

            socket.emit('win', {user : users[socket.id], point : p});
            socket.broadcast.emit('other win', {user : users[socket.id], point : p, shaman : shaman.nick});
        } else {
            users[socket.id].block = false;
            users[socket.id].lives --;
            users[socket.id].score --;
            if(users[socket.id].lives <= 0)
                users[socket.id].block = true;

            socket.emit('failed', {user : users[socket.id], again : again});
            socket.broadcast.emit('other failed', {user : users[socket.id], again : again});
        }

        var end = true;
        for(var index in users) {
            var user = users[index];
            if(!user.block && user.start) {
                end = false;
                break;
            }
        }

        if(end) {
            socket.emit('end game', {answer : answer});
            socket.broadcast.emit('end game', {answer : answer});
        }

        socket.emit('update list', {users : users});
        socket.broadcast.emit('update list', {users : users});
    });

    // quando o shaman desiste de jogar, perde 10 pontos e envia mensagem para todos dizendo que o jogo vai reiniciar
    socket.on('cancel game', function() {
        users[shamanID].score -= 10;
        socket.emit('shaman cancel', {shaman : shaman.nick, answer : answer});
        socket.broadcast.emit('shaman cancel', {shaman : shaman.nick, answer : answer});

    });

   // quando todos jogaram ou o shaman desistiu, gera as variaveis e volta pra sala de espera
    socket.on('restart game', function() {

        ingame = false;
        answer = '';
        shaman = '';
        shamanID = '';
        points = 10;


        for(var index in users) {
            var user = users[index];
            user.lives = 5;
            user.start = false;
            user.block = false;

        }

        socket.emit('user in', {users : users});
        socket.broadcast.emit('user in', {users : users});

    });
});

io.sockets.on('disconnect', function(socket) {

    socket.emit('disconnect');

});
