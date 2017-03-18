//conexão e variaveis globais
var socket = io.connect('http://localhost:3000');

var block = true;
var context;
var drawing;
var rect;

// exibe alerta com propt para escolher o nome, envia o nome para o servidor
socket.on('login', function() {
    var nick = '';
    do{
        nick = prompt("Qual é o seu nome?");
    }while(nick == null || nick == "" );

    socket.emit('login posted', {nickname : nick});
});

// Atualiza a lista de usuarios logados exibindo e ele quer ou nao jogar
socket.on('user in',function(data) {
    $('#users').empty();
    $.each(data.users, function(index, value) {
        var message = (value.start) ? 'quer iniciar' : 'quer mais jogadores';
        $('#users').prepend('<li><strong>'+value.nick+'</strong> '+message+'!</li>');
    });
});

// Quando entra algum usuario, mostra sua entrada na lista de eventos
socket.on('out login',function(data) {
    $('#events').prepend('<li><strong>'+data.user.nick+'</strong> entrou!</li>');
});

// quando sai algum usuario mostra na lista de eventos que ele saiu
socket.on('logout',function(data) {
    $('#events').prepend('<li><strong>'+data.user.nick+'</strong> saiu!</li>');
});

// atualiza lista de usuarios, colocando seus pontos e vidas
socket.on('update list',function(data) {
    $('#users').empty();

    $.each(data.users, function(index, value) {
        $('#users').prepend('<li><strong>'+value.nick+'</strong> tem '+value.score+' pontos e '+value.lives+' vidas!</li>');
    });
});

// Exibe que o jogo foi iniciado, mudando o botao para mostrar quem é o shaman e atualiza a lista
socket.on('start game',function(data) {
    $('#events').prepend('<li><strong>O jogo foi iniciado!</strong></li>');
    $('#go-game button')
        .hide('fast')
        .text(data.shaman+' é o da vez!')
        .show('fast');

    $('#users').empty();
    $.each(data.users, function(index, value) {
        $('#users').prepend('<li><strong>'+value.nick+'</strong> tem '+value.score+' pontos e '+value.lives+' vidas!</li>');
    });
});


// se o cliente for o shaman, desbloqueia funções de deseho e botao de desistir, exibe um propt para que ele coloque a resposta
socket.on('is shaman',function(data) {
    $('#hiddenshaman').show('fast');
    $('#go-game button')
        .hide('fast')
        .removeClass('btn-primary')
        .addClass('btn-danger')
        .text('Você é o da vez, desenhe!')
        .show('fast');

    var answer = '';
    do{
        answer = prompt("O que é seu desenho? (resposta)");
    }while(answer == null || answer == "" );

    socket.emit('answer posted', {answer : answer});
    block = false;
});


// quando shaman deu a resposta, exibe que o jogo vai iniciar
socket.on('open answers',function(data) {
    $('#events').prepend('<li><strong>Resposta definida, respostas liberadas!</strong></li>');
    $('#hidden').show('fast');
});

// quando shaman começa um risco, começa a desenhar aqui ambem
socket.on('display init draw',function(data) {
    context.beginPath();
    context.moveTo(data.x, data.y);
});

// quando shaman esta desenhando aqui tambem está
socket.on('display draw',function(data) {
    context.lineTo(data.x, data.y);
    context.strokeStyle = data.color;
    context.stroke();
    drawing.beginPath();
});

// quando usuario ganho, mostra na lista de eventos e se tiver bloqueado oculta campo de resposta
socket.on('win',function(data) {
    $('#events').prepend('<li><strong>'+data.user.nick+'</strong> acertou e ganhou '+data.point+' pontos!</li>');
    $('#events').prepend('<li>O shaman ganhou 5 pontos!</li>');
    if(data.user.block)
        $('#hidden').hide('fast');
});

// quando usuario falhou, mostra que ele tentu e errou e se tiver bloqueado oculta campo de resposta
socket.on('failed',function(data) {
    $('#events').prepend('<li><strong>'+data.user.nick+'</strong> tentou <i>'+data.again+'</i> e perdeu 1 ponto!</li>');
    if(data.user.block)
        $('#hidden').hide('fast');
});


// quando outro usuario ganhoum mosta que ele ganhou no eventos
socket.on('other win',function(data) {
    $('#events').prepend('<li><strong>'+data.user.nick+'</strong> acertou e ganhou '+data.point+' pontos!</li>');
    $('#events').prepend('<li>O '+data.shaman+' ganhou 5 pontos!</li>');
});


// quando outro usuario perdeu mosta que ele perdeu no eventos
socket.on('other failed',function(data) {
    $('#events').prepend('<li><strong>'+data.user.nick+'</strong> tentou <i>'+data.again+'</i> e perdeu 1 ponto!</li>');
});


// quando shaman desistiu, mostra que ele desistiu e prepara para reiniciar o jogo
socket.on('shaman cancel',function(data) {
    $('#events').prepend('<li>'+data.shaman+' desistiu do jogo, e perdeu 10 pontos!</li>');
    $('#events').prepend('<li>A resposta era <strong>'+data.answer+'</strong>!</li>');
    $('#hidden').hide();
    $('#hiddenshaman').hide();
    block = true;
    $('#go-game button')
        .prop('disabled', false)
        .hide('fast')
        .removeClass('btn-danger')
        .addClass('btn-primary')
        .text('Quero jogar logo!')
        .show('fast');
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('restart game');
});

// quando o jogo acaba, mostra que acabou e reinicia o game
socket.on('end game',function(data) {
    $('#events').prepend('<li>O jogo acabou!</li>');
    $('#events').prepend('<li>A resposta era <strong>'+data.answer+'</strong>!</li>');
    $('#hidden').hide();
    $('#hiddenshaman').hide();
    block = true;
    $('#go-game button')
        .prop('disabled', false)
        .hide('fast')
        .removeClass('btn-danger')
        .addClass('btn-primary')
        .text('Quero jogar logo!')
        .show('fast')
    context.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('restart game');
});

// quando um usuario tenta entrar mas ha um jogo acontecento, motra em alerta pra ele
socket.on('in game',function(data) {
    alert('Estamos no meio de um jogo, espere ele acabar');
    $('#go-game button').prop('disabled', false);
});


// quando jogador tenta iniciar um jogo com apenas ele, mostra um alerta
socket.on('one player',function(data) {
    alert('Não é possível jogar apenas com um player online');
    $('#go-game button').prop('disabled', false);
});


// JQUERY AQUI
$(function() {

    // atribui variaveis
    var color = 'rgb(0,0,0)';

    $('#hidden').hide();
    $('#hiddenshaman').hide();
    context = $('#canvas')[0].getContext('2d');
    drawing = false;
    rect = $('#canvas')[0].getBoundingClientRect();

    // clique no canvas, começa a desenhar e envia sinal pra clientes
    $('#canvas').mousedown(function (evt) {
        if(!block) {
            context.beginPath();
            context.moveTo(evt.clientX - rect.left, evt.clientY - rect.top);
            socket.emit('init drawing', {x: evt.clientX - rect.left, y: evt.clientY - rect.top});
            drawing = true;
        }
    });

    // quando o jogador termina um risco no canvas
    $('#canvas').mouseup( function () {
        if(!block)
            drawing = false;
    });

    // quando usuario esta desenhando, desena e envia aos demais
    $('#canvas').mousemove(function (evt) {
        if (drawing && !block) {
            context.lineTo(evt.clientX - rect.left, evt.clientY - rect.top);

            context.strokeStyle = color;
            socket.emit('drawing', {x: evt.clientX - rect.left, y: evt.clientY - rect.top, color : color});
            context.stroke();
        }
    });

   // quando ele troca de cor
    $('#colors li').click(function() {
        color = $(this).children('div').css('backgroundColor');
        $('#select').css('backgroundColor', color);
    });

   // ao recarreagar a pagina, desconecta ele
    window.onbeforeunload = function() {
        socket.disconnect();
    }

   // ao clicar em iniciar jogo, envia sinal ao servidor
    $('#go-game').submit(function(e) {
        $('#go-game button').prop('disabled', true);
        socket.emit('go game');
        return false;
    });

     // ao clicar em dar a resposta, envia sinal ao servidor
    $('#send-answer').submit(function() {
        socket.emit('check answer', {again : $('#again').val()});
        $('#again').val('');
        return false;
    });

    // quando shaman cancela jogo, envia sinal ao servidor
    $('#cancel').submit(function() {
        socket.emit('cancel game');
        return false;
    });
});
