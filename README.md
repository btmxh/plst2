# plst2

media player server

>imagine having to hoard songs (u can do it when they will be killed)
>imagine having to cope with mpv+yt-dlp slowashell speed and unstablity (only audio was loaded for some videos bruh)
>imagine not having nrs integration

don't mind the `2` suffix

designed to be self-hosted (on the playback machine), minimal (no meme shit like react, bootstrap, etc.), also may feature some hypermedia autism (inspired by htmx)

>basically think this as a GUI app that was turned into a web app because proprietary embed APIs (youtube, spotify, etc.), the underlying server is there to do stuff that a native GUI app could do

as always, APIs are undocumented kek, so go look at my horrible express code (i will try to clean it later)

you need youtube-dl/yt-dlp on the server (no i will not use the official api, and thanks to that you won't need to go to google cloud bullshitery and make an API key) to fetch data (and not to download the video/audio, so no weird novideo glitch shit) if you want to play youtube video (currently the only supported media kek).
>define env var YOUTUBE_DL to be path/to/youtube-dl if it's not the default "yt-dlp"

to use:
```sh
# fill .env or environment vars
# PORT: server port (default: 8080)
# NODE_ENV: production or development (default: idk)
yarn install
yarn dev
yarn start
```
