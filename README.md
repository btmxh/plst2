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

## how to use

this is a media player server. by itself, it does not play media. you need a web browser to open the webpage, in which you can queue your media by inserting the url (currently supported: youtube and local).

to add a youtube video, simply take the video url (or `yt.be/VIDEOURL`) for the shortest possible url.

to add a local media (on the machine that the server is running on), use the file:// url like `file:///home/user/Videos/video.mp4`. audio files are also supported, and do note that only basic formats (supported by a web browser) can work.

after typing the url, press the add button to add media to the queue. the two options "add to queue" and "queue next" are self-explanatory.

the playlist controls are also self-explanatory, and no, they don't use icons because muh minimalism.

the playlist is a huge checklist, which is used in combination with some playlist controls like "up", "down" and "remove". this is based on 4chan.

## additional features

this has built-in [mpris](https://specifications.freedesktop.org/mpris-spec/latest/) support, so you can use your fancy keyboard shortcuts to toggle play-pause, and go to the next and previous media, etc. you can also use that to query information about the current media, and display that on your i3bar or something.

if copying urls is too inconvenient for you, use the [plst-ext](https://github.com/btmxh/plst-ext) extension (should work fine on all browsers) to have some quality-of-life features like open links in plst2.

not a feature, but the server will output a cache file every time it's been run. this file acts as a database for the server, and it is a very friendly-formatted json file, so you can get some info from there. maybe i will move to sqlite if i need that, but for now there is that json file.

## autistic FAQ section

>muh why cringe node.js, why don't use that rocket blazingly fast language or at least javac#kotlinetcetc

i don't talk with languages that takes 10gb ram for lsp/1 hour of gradle initialization/2 hour of cargo build time + no hot reloading

>muh why not deno and bun etc.

bun is cooking up their autistic bundler which is too experimental for me to use

deno is a bunch of unmaintained dependencies

node/npm is cringe and all, but at least i have the ecosystem here

>why are you so autistic

read history


