@echo off
cd /d "C:\Users\Василий\Documents\Книги Александр\Я в деле\мой проект\MVP1"
echo ===== npm install ===== >> verify_log.txt 2>&1
call npm install >> verify_log.txt 2>&1
echo EXIT_CODE_INSTALL=%ERRORLEVEL% >> verify_log.txt

echo ===== db:generate ===== >> verify_log.txt 2>&1
call npm run db:generate >> verify_log.txt 2>&1
echo EXIT_CODE_GENERATE=%ERRORLEVEL% >> verify_log.txt

echo ===== db:migrate ===== >> verify_log.txt 2>&1
call npm run db:migrate >> verify_log.txt 2>&1
echo EXIT_CODE_MIGRATE=%ERRORLEVEL% >> verify_log.txt

echo ===== db:seed ===== >> verify_log.txt 2>&1
call npm run db:seed >> verify_log.txt 2>&1
echo EXIT_CODE_SEED=%ERRORLEVEL% >> verify_log.txt

echo ===== typecheck ===== >> verify_log.txt 2>&1
call npm run typecheck >> verify_log.txt 2>&1
echo EXIT_CODE_TYPECHECK=%ERRORLEVEL% >> verify_log.txt

echo DONE >> verify_log.txt
