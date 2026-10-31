#!/usr/bin/env bash
set -e
RES=android/app/src/main/res

# 1) اسم التطبيق بالعربية
sed -i 's#<string name="app_name">.*</string>#<string name="app_name">نظام التأمينات</string>#; s#<string name="title_activity_main">.*</string>#<string name="title_activity_main">نظام التأمينات</string>#' $RES/values/strings.xml

# 2) أيقونة التطبيق (نستبدل الأيقونة الافتراضية)
rm -f $RES/mipmap-anydpi-v26/ic_launcher.xml $RES/mipmap-anydpi-v26/ic_launcher_round.xml
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  n=${pair%%:*}; s=${pair##*:}
  mkdir -p $RES/mipmap-$n
  for f in ic_launcher ic_launcher_round ic_launcher_foreground; do cp icons/icon-$s.png $RES/mipmap-$n/$f.png; done
done

# 3) مكتبة Excel داخل التطبيق (ليعمل الاستيراد والتصدير بدون إنترنت)
cp node_modules/xlsx/dist/xlsx.full.min.js www/xlsx.full.min.js
sed -i 's#https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js#xlsx.full.min.js#' www/index.html

# 4) إذن الكاميرا لتصوير المستندات
grep -q 'android.permission.CAMERA' android/app/src/main/AndroidManifest.xml || \
  sed -i 's#<application#<uses-permission android:name="android.permission.CAMERA" />\n    <application#' android/app/src/main/AndroidManifest.xml
echo "customize done"
