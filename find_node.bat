@echo off
echo PATH=%PATH% >> find_node_log.txt
where node >> find_node_log.txt 2>&1
where npm >> find_node_log.txt 2>&1
dir "C:\Program Files\nodejs\" >> find_node_log.txt 2>&1
dir "C:\Users\Василий\AppData\Roaming\nvm\" >> find_node_log.txt 2>&1
dir "C:\Users\Василий\AppData\Local\Programs\nodejs\" >> find_node_log.txt 2>&1
