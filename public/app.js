angular.module('myApp', ['ui.router']).service('Session', function() {
    this.user = localStorage['user'] ? localStorage['user'] : null;
    this.room = localStorage['room'] ? localStorage['room'] : null;
    this.setUser = (Ud, cb) => {
        this.user = Ud.username;
        this.room = Ud.room;
        localStorage['user'] = Ud.username;
        localStorage['room'] = Ud.room;
        console.log('Setting userdata')
        cb();
    }
    this.clearUser = (cb) => {
        this.user = '';
        this.room = ''
        delete localStorage['user'];
        delete localStorage['room'];
        cb();
    }
}).config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');
    $stateProvider.state('main', {
        url: '/'
    }).state('login', {
        url: '/login',
        views: {
            'content': {
                templateUrl: 'login.html'
            }
        }
    }).state('chat', {
        url: '/chat',
        views: {
            'content': {
                templateUrl: 'chat.html'
            }
        }
    })
}]).run(function($rootScope, $state, Session) {
    $rootScope.$on('$stateChangeStart', function(e, toState) {
        if (toState.url == '/') {
            if (Session.user) {
                e.preventDefault();
                $state.go('chat', {});
            } else {
                e.preventDefault();
                $state.go('login', {});
            }
        } else if (toState.url == '/chat') {
            if (!Session.user) {
                e.preventDefault();
                $state.go('login', {});
            }
        } else if (toState.url == '/login') {
            if (Session.user) {
                // console.log('HEREEEEEEEEEEEEEE')
                e.preventDefault();
                $state.go('chat', {});
            }
        }
    })
}).service('Socket', function($timeout, Session) {
    var socket = io();
    socket.on('connect', function() {
        if (Session.user) {
            socket.emit('initSocket', Session.user)
        }
    })
    this.emit = function(event, data, cb) {
        console.log("Emitting::", event, data);
        socket.emit(event, data, function(response) {
            if (cb) {
                $timeout(function() {
                    cb(response);
                })
            }
        });
    }
    this.on = function(event, callback) {
        socket.on(event, function(cb) {
            $timeout(function() {
                callback(cb);
            })
        })
    }
}).controller('loginController', ['$scope', '$location', 'Session', 'Socket','$timeout', function($scope, $location, Session, Socket,$timeout) {
    console.log("Socket::", Socket);
    $scope.errorText = "";
    $scope.admin = false;
    $scope.$watch('username', function() {
        if($scope.username == "Admin") {
        console.log("ADMIN DETECTED");
        $scope.admin = true;
        
        }else{
        // console.log("Admin NOT DETECTED");
        $scope.admin = false;
        }      

    });



    $scope.login = function() {
        
        if(angular.isUndefined($scope.username) || angular.isUndefined($scope.room)){
            console.log("UNDEFINED DETECTED");
            $scope.errorText = "Enter valid Details";
            $scope.username = undefined;
            $scope.room = undefined;
            $location.path('/');
        } else {

        var usrDetails = {
            username: $scope.username,
            room: $scope.room
        };
        // console.log("usrDetails:"+ usrDetails.username+" "+ usrDetails.room);
        Socket.emit('joinRoom', {
            name: usrDetails.username,
            room: usrDetails.room
        })
        // Socket.on('clientInfo',function(ci){
        //     console.log("clientInfo"+ci);
        // })
        Socket.emit('register', usrDetails, function(response) {
            console.log('login Response', response)
            if (response == 'success') {
                Session.setUser(usrDetails, function(response) {
                    $location.path('/');
                })
            }
            if (response == 'error') {
                $scope.errorText = "Username already taken";
            }
        });
        }
    }
}]).controller('chatController', ['$scope', 'Socket', 'Session', '$state', '$timeout', function($scope, Socket, Session, $state, $timeout) {
    $scope.user = Session.user;
    $scope.room = Session.room;
    $scope.disconnect = function() {
        Socket.emit('logout', $scope.user, function() {
            console.log('Logout success')
            Session.clearUser(function() {
                $state.go('login', {});
            })
        })
    }
    $scope.sendMessage = function(text) {
        if (text && text.substr(0, 1) === '/') {
            var privatemsg = {};
            privatemsg.sender = $scope.user;
            privatemsg.user = text.substr(1, text.indexOf(' '));
            privatemsg.user = privatemsg.user.trim();
            privatemsg.msg = text.substring(text.indexOf(' '));
            privatemsg.room = $scope.room;
            $scope.messageInput = "";
            Socket.emit("PrivateMsg", privatemsg, function(response) {
                console.log("PrivateMsg response:" + response);
            });
        } else {
            var timestamp = moment().valueOf();
            var momentTime = moment.utc(timestamp);
            momentTime = momentTime.local().format('h:mm a');
            var newMessage = {
                sender: $scope.user,
                text: text,
                time: momentTime,
                room: $scope.room
            }
            Socket.emit("chatMessage", newMessage, function(response) {
                if (response == 'success') {
                    $scope.messages.push(newMessage)
                    $scope.messageInput = "";
                    $timeout(() => {
                        var container = document.getElementById('messageContainer');
                        container.scrollTop = container.scrollHeight - container.clientHeight;
                    });
                }
            });
        }
    }
    $scope.getMessages = function() {
        Socket.emit('getMessages', {}, function(messages) {
            console.log('Messages:', messages)
            $scope.messages = messages;
            $timeout(() => {
                var container = document.getElementById('messageContainer');
                if (container) {
                    container.scrollTop = container.scrollHeight - container.clientHeight;
                }
            });
        })
    }
    $scope.getMessages();
    Socket.on('chatMessage', function(message) {
        $scope.messages.push(message);
        $timeout(() => {
            var container = document.getElementById('messageContainer');
            container.scrollTop = container.scrollHeight - container.clientHeight;
        });
    })
}])