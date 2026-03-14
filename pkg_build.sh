#!/bin/bash

plugin_name="docker.labelManager"
CWD=$(pwd)
tmpdir="$CWD/tmp/tmp.$(($RANDOM * 19318203981230 + 40))"
version="1.0.7"
filename="$CWD/archive/$plugin_name-$version.txz"
rm -f "$filename"
mkdir -p "$tmpdir"

rsync -av --progress src/$plugin_name/ "$tmpdir" --exclude .git --exclude tmp --exclude .env --exclude archive

cd "$tmpdir" || exit

tar_command="tar"
sed_prefix="-i"

if [[ "$(uname)" == "Darwin" ]]; then
    tar_command="gtar"
    sed_prefix="-i ''"
fi
$tar_command --owner=root --group=root -cJf "$filename" .

cd - || exit

if [[ "$(uname)" == "Darwin" ]]; then
    md5hash=$(md5 -q "$filename")
else
    md5hash=$(md5sum "$filename" | awk '{ print $1 }')
fi

rm -rf "$tmpdir"

sed "$sed_prefix" 's/<!ENTITY version ".*">/<!ENTITY version "'"$version"'">/' $plugin_name.plg
sed "$sed_prefix" 's/<!ENTITY md5 ".*">/<!ENTITY md5 "'"$md5hash"'">/' $plugin_name.plg

echo "MD5: $(md5sum "$filename")"
echo "once pushed install via https://raw.githubusercontent.com/Coryrichter94/Docker.Label.Manager.Unraid/main/$plugin_name.plg"

$tar_command -tvf "$filename"

# Check for ownership issues
OWN=$($tar_command -tvf "$filename" | grep -v "root/root" | grep -v "root   root")
if [ -n "$OWN" ]; then
    echo "Ownership issues (should be root/root):"
    echo "$OWN"
    exit 1
fi

# Check for permission issues
PERM=$($tar_command -tvf "$filename" | grep -v "rwxr-xr-x" | grep -v "rw-r--r--")
if [ -n "$PERM" ]; then
    echo "Permission issues (should be rwxr-xr-x or rw-r--r--):"
    echo "$PERM"
    exit 1
fi
