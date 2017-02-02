procs=`ps aux | grep "trelloBugFile" | awk '{print $2}'`

for i in $procs
do
        `sudo kill $i`
done
