docker stop ava-chat-server
docker rm ava-chat-server
docker rmi -f ava-chat-server:latest
docker build . -t ava-chat-server:latest
# docker run -d --name ava-chat-server -p 8081:8081 ava-chat-server:latest
