/* ============================================================
   Picksy Mascot — AI-куратор з ім'ям, характером і пам'яттю
   ============================================================
   Public API:
     Picksy.svg(opts?)               -> string   SVG markup of the mascot
     Picksy.render(target, o?)       -> Element  inject mascot into a DOM node
     Picksy.setMood(el, mood)                    swap mood on a mounted mascot
     Picksy.setBubble(el, text, intro)           swap speech bubble text
     Picksy.phrase(context, optsOrL?) -> string  pick a contextual phrase (anti-repeat).
                                                  optsOrL may be a lang string or
                                                  { lang, type } where type is
                                                  'movie' | 'tv' | 'book' for loading.
     Picksy.greet()                  -> { phrase, mood, bucket }
     Picksy.commentary(item, type)   -> string   AI commentary for a pick
     Picksy.showCommentary(host, t)              UI: commentary card
     Picksy.mountLoadingMascot(type?)            UI: loading overlay (type-aware)
     Picksy.mountHero()                          UI: index hero
     Picksy.decorateEmptyList(host)              UI: saved empty state
     Picksy.observeSavedList()                   wires the mutation observer
     Picksy.mountFab(opts?)                      DEPRECATED no-op (was: floating Picksy)
     Picksy.mountQuiz(opts?)                     UI: quiz.html companion
     Picksy.mountMatch(opts?)                    UI: match.html companion
     Picksy.mountGame(opts?)                     UI: game/wordle reactions
     Picksy.aiLine(prompt, ctx?)     -> Promise<string>   backend AI-generated line
     Picksy.memory                   -> { get, set, addPick, sync, recall, name }
     Picksy.moods                    -> string[]

   SEO:
     - SVG markup includes <title>, <desc> and role="img" for screen readers.
     - aria-label is set on the wrapper for non-decorative usages.
     - All copy is i18n-aware (uk/en) so visible text stays indexable.
     - Speech bubbles use HTML text (not SVG <text>) so search engines index them.
*/
(function (global) {
    'use strict';

    var MOODS = ['happy', 'excited', 'tired', 'thinking', 'sad', 'shocked', 'wink', 'smirk'];

    // ===========================================================
    // PHRASE LIBRARY — Picksy persona: warm, sharp, slightly sassy.
    // Expanded across many contexts so he feels alive everywhere.
    // ===========================================================
    var PHRASES = {
        uk: {
            // ─── home hero greetings, by time of day
            hero: {
                morning: [
                    'Привіт. Ще не зовсім прокинувся, але вже шукаю тобі фільм ☕',
                    'Ранок добрий. Що дивимось — щось легке під каву?',
                    'Я Picksy. Кінокотушка з характером. Що сьогодні хочеться?',
                    'Ще трохи, і я прокинусь. Але вибирати вмію навіть так',
                    'Я ще сонний, але смак не зрадить. Жени настрій',
                    'Доброго ранку! Сьогодні я в режимі "обережно з тригерами"',
                    'Каву наливай, а я вже гортаю афішу',
                    'Ще ранній, але я готовий до підбірки. Кажи настрій',
                    'Ранок — ідеально для тихого кіно. Або голосного, як хочеш',
                    'Привіт-привіт. Тиждень довгий — кіно коротке',
                    'Я вчора передивлявся каталог. Маю кілька ідей для тебе',
                    'Прокидаймось разом. Скажи жанр — я зроблю решту'
                ],
                day: [
                    'Гей! Я Picksy. Скажи мені настрій — я дістану ідеальний фільм',
                    'Що дивимось сьогодні? Скажи що завгодно — я зрозумію',
                    'Я тут, щоб ти не скролив каталоги по годині. Що хочеться?',
                    'Полудень — гарний час для відкриття чогось нового',
                    'Працюю наживо. Один підбір — і ти знаєш, що дивитись',
                    'Привіт. Свіжа кава, свіжий каталог, свіжий настрій. Поїхали',
                    'Денний Picksy на звʼязку. Що сьогодні дивимось?',
                    'Тихий полудень — гарний час знайти щось нове',
                    'Я вже відсортував те, що тобі точно зайде. Кажи настрій',
                    'Кіно посеред дня — теж нормально. Не ховайся',
                    'Швидкий підбір — поки кава ще не охолола',
                    'Маю кілька несподіванок для тебе. Жени запит'
                ],
                evening: [
                    'Вечір — найкращий час для кіно. Що дістати з полиці?',
                    'Я бадьорий і готовий. Скажи настрій — підберу за 5 секунд',
                    'Прийшов з роботи? Сідай, я вже маю для тебе ідею',
                    'Світло приглушуй — починаємо вибирати кіно вечора',
                    'Ставлю на те, що тобі сьогодні треба щось атмосферне',
                    'Час включити Picksy-mode. Що нам треба — фільм, серіал, книга?',
                    'День був довгий — нехай вечір буде смачним. Що дивимось?',
                    'Плед, чай, кіно. Я підбираю — ти просто скажи настрій',
                    'Вечірня зміна Picksy. Маю кілька прихованих перлин',
                    'Без серіалів-жуйок. Маю щось серйозне для тебе',
                    'Світло — приглушити, телефон — у бік. Починаємо',
                    'Я в режимі куратора. Скажи що хочеться — підберу'
                ],
                night: [
                    'Не спиться? Маю ідею. Скажи що хочеться — я не сплю ніколи',
                    'Опівнічний кіно-сеанс? Я тут. Жанр який?',
                    'Нічна зміна Picksy на зв\u02bcязку. Що дивимось?',
                    'Світ спить — а ми обираємо кіно. Класика',
                    'Я найкраще працюю після опівночі. Дай настрій',
                    'Бачу, ти серед своїх. Що дивимось — щось тихе чи навпаки?',
                    'Безсоння — мій час. Маю фільм-снодійне і фільм-струс',
                    'О цій годині я підбираю особливо чесно',
                    'Ніч — не страшно. Тут є я. І один цікавий фільм',
                    'Тиша, екран і ти. Дай настрій — я підлаштуюсь',
                    'Опівнічний підбір — особливо персональний. Кажи'
                ],
                returning: [
                    'Ой, знайома фігура. Радий бачити знову 👀',
                    'З поверненням! Я тебе пам\u02bcятаю',
                    'А ось і ти. Я вже грів каталог',
                    'Картинка хороша — ти повернувся. Дивимось?'
                ]
            },
            // ─── loading-state lines — cycles every ~2.2 seconds
            // "loading" is the generic fallback. type-specific arrays
            // (loading_movie, loading_tv, loading_book) override when
            // mountLoadingMascot(type) is called with the type.
            loading: [
                'Гортаю каталог...',
                'Перебираю плівки на полиці...',
                'Звіряюся з відгуками...',
                'Зважую варіанти...',
                'Майже знайшов щось особливе...',
                'Ще секунду — обираю найкраще...',
                'Хм, цей теж непоганий, але треба краще',
                'Думаю-думаю-думаю...',
                'Перевіряю, чи це не той самий, що я вже радив',
                'Шукаю те, що ти ще не бачив',
                'Згадую, що тобі заходило раніше...',
                'Цей варіант або шедевр, або фейл — гадаю',
                'Спитав у колег по цеху, перевіряю...',
                'Скоро. Не йди',
                'Це або хіт, або провал. Треба переконатись',
                'Так-так, цей жанр — твоя слабкість',
                'Перевіряю, чи це доступно у твоїй країні',
                'Чую запах хорошого фільму',
                'Якщо це не зайде — я ображусь. Жартую',
                'Ще трошки, я перфекціоніст',
                'Перевіряю рейтинги, обираю не з популярних',
                'Хвилинку — це делікатна справа',
                'Тримай попкорн напоготові',
                'Знайшов кандидата. Ще один підстраховку',
                'Думаю як критик, обираю як друг',
                'Скоро покажу. Я не люблю поспіх',
                'Перебираю кадри як старий проектор',
                'Тс-с-с, я ловлю ідею',
                'Зараз буде, не зачіпай монтажиста',
                'Звіряю настрій, погоду і твою карму',
                'Каталог сьогодні балакучий — слухаю',
                'Збираю ідеальний кадр для тебе',
                'Я не поспішаю — поспіх псує смак',
                'Хвилинку — звіряюсь з твоїм минулим вибором',
                'Один кандидат уже є, але я хочу більший простір',
                'Зважую тон, темп і твою енергію',
                'Знаходжу історію, яку ти не очікуєш',
                'Перевіряю, щоб ця рекомендація не повторювалась',
                'Готую варіант, який ти не зміг би придумати сам',
                'Я майже зловив правильний кадр',
                'Ще трошки — кадр якісь не доварений',
                'Зараз буде. Я не люблю халтуру',
                'Запускаю режим тонкого настрою'
            ],
            loading_movie: [
                'Перевіряю стрічку на склейках...',
                'Гортаю кінокатушку — шукаю твій фільм',
                'Прокручую трейлер у голові, мушу пересвідчитись',
                'Цей кадр у тебе ще не світив на екрані?',
                'Знаходжу режисера, який знайде твоє серце',
                'Шарю по золотому фонду і свіжачку одночасно',
                'Перевіряю, чи фільм тримає темп до титрів',
                'Думаю, який саундтрек тобі сьогодні зайде',
                'Звіряюся з критиками — і завжди роблю по-своєму',
                'Поки що твердий нейтрал. Зараз буде "вау"',
                'Уявляю тебе в кінозалі — чи зайде?',
                'Прикидаю хронометраж під твій вечір',
                'Шукаю фільм без зайвої води',
                'Перевіряю, чи фінал не зіпсує враження',
                'Поки промотую — питаю себе: ти захочеш переглянути?',
                'Чую запах попкорну — отже, я близько',
                'Цей вечір — твоя кіноісторія. Я підбираю першу сцену',
                'Ще хвилина — і ти отримаєш фільм-настрій',
                'Зараз порівняю з тим, що ти любив раніше',
                'Цей фільм або стане улюбленим, або влетить у меми. Перевіряю',
                'Цей фільм пишається титрами — є шанс, що зайде',
                'Перевіряю, чи кадр виглядає так само живо вночі',
                'Шукаю фільм без передбачуваного фіналу',
                'Підкручую звук уявно — щоб тобі точно зайшло',
                'Хвилинку — обираю стрічку, а не контент',
                'Шукаю фільм, у якому пауза — це частина історії',
                'Готую варіант, де ти не потягнешся за телефоном',
                'Цей фільм або шедевр, або затягне у дискусії. Перевіряю'
            ],
            loading_tv: [
                'Звіряюся з пілотом — чи варто рекомендувати',
                'Прокручую перші три серії — ловлю темп',
                'Цей серіал тримає сюжет чи розмазує? Перевіряю',
                'Шукаю шоу, від якого не відірвешся',
                'Думаю, скільки сезонів ти витримаєш',
                'Перевіряю, чи фінал не зрадить тебе',
                'Поки не скажу — але це твоя нова залежність',
                'Підбираю серіал під твій графік сну (вибач його)',
                'Шукаю шоу з персонажами, у яких хочеться жити',
                'Серіал без пустих серій? Складно. Але я знайду',
                'Перевіряю, чи можна дивитись по одній серії (спойлер: ні)',
                'Шукаю історію, у яку хочеться повертатись',
                'Ще секунду — обираю драматургію, не «жуйку»',
                'Цей актор зробить тобі вечір. Гадаю...',
                'Підбираю шоу, де не доведеться гуглити «що відбувається»',
                'Ти просив серіал — я підбираю світ, у який не шкода зануритись',
                'Шукаю шоу, яке ти переказуватимеш друзям',
                'Перевіряю, чи витримаєш cliffhanger',
                'Цей серіал або затягне, або скажеш «дякую, ні». Перевіряю',
                'Хвилинку — я звіряюсь з аудиторією і своїм смаком',
                'Шукаю серіал, де перший епізод не виглядає як трейлер',
                'Перевіряю, скільки серій треба, щоб закохатись',
                'Цей серіал тримає тон — рідкість. Я уважно',
                'Підбираю шоу з персонажами, з якими хочеться залишитись',
                'Шукаю серіал без зайвих філерів',
                'Цей серіал краще дивитись з ким\u02bcсь. Перевіряю',
                'Готую серіал, який можна цитувати'
            ],
            loading_book: [
                'Гортаю палітурки — шукаю твою книгу',
                'Перевіряю, чи витримаєш перші 50 сторінок',
                'Шукаю книгу, від якої не хочеться відриватись',
                'Перевіряю стиль — не з тих, що засинаєш на третій главі',
                'Звіряюся з відгуками і своїм нюхом',
                'Цю книгу читають з підкресленнями. Перевіряю',
                'Шукаю книгу, що змінює погляд хоч на щось',
                'Перевіряю переклад (бо погана версія — псує враження)',
                'Чую запах нового тексту — і трохи кави',
                'Підбираю книгу під твій настрій, а не списки бестселерів',
                'Перевіряю, чи фінал не зіллє все, що ти проживав',
                'Шукаю книгу, де персонажі живі, а не схема',
                'Ще трохи — і ти будеш гортати до 2 ночі',
                'Цю книгу любитимеш або ненавидітимеш — без середини. Перевіряю',
                'Шукаю книгу, до якої ти повернешся через рік',
                'Перевіряю, чи звучить мова, а не текст',
                'Не книга — кінотеатр у голові. Шукаю саме таку',
                'Підбираю книгу, де перший абзац б\'є під дих',
                'Ще секунду — звіряюсь з твоїми збереженими',
                'Якщо ти не зачитаєшся — я не Picksy',
                'Шукаю книгу, після якої хочеться поговорити',
                'Перевіряю, чи розділи в твоєму темпі',
                'Готую книгу, де персонажі дихають, а не існують',
                'Шукаю книгу, від якої ти не подивишся в телефон до 100-ї сторінки',
                'Перевіряю, чи фінал не зливає сюжет',
                'Цю книгу читали з підкресленнями. Уважно',
                'Готую варіант з тиху силу, не галас'
            ],
            // ─── empty saved list — when user has zero saves
            empty_saved: [
                'Ну то давай вже щось підберемо, я скучив',
                'Тут поки порожньо. Зберігай те, що сподобалось — я запам\u02bcятаю',
                'Збережене — твій особистий стелаж. Поки що порожній.',
                'Не соромся ❤️ — натисни «Зберегти» на хорошому фільмі',
                'Я тут чекаю. Збережи перший фільм — і я зрозумію твій смак',
                'Без збережених я не вгадую — давай почнемо',
                'Ну, не зберігав нічого — не зрозумію, що тобі треба. Допомагай 🙏',
                'Тут поки тиша. Заповни її першим обраним фільмом',
                'Збережені — це моя пам\u02bcять. Заведи її',
                'Натисни ❤️ на чомусь хорошому — і я почну вгадувати точніше',
                'Поки порожньо — я ще тебе не знаю. Дай мені шанс'
            ],
            empty_collections: [
                'Колекцій ще нема. Створи першу — я допоможу її наповнити',
                'Колекція — це як власний кінозал. Створи свій!',
                'Тут буде твоя кіно-вселенна. Поки що порожня. Виправляй'
            ],
            // ─── AI-commentary on a single picked item, by genre
            ai_commentary: {
                generic: [
                    'Ось мій вибір. Я б ще не радив на побачення, але як знаєш',
                    'Підбірка готова. Якщо не зайде — натисни «Ще», я не образжусь',
                    'Перевірено: я б сам подивився',
                    'Підказка: попкорн уже на стіл, далі дивись',
                    'Воу. Цей варіант — серйозна заявка на вечір',
                    'Дивись уважно — деталі тут вирішують',
                    'Раджу подивитись з кимось — буде що обговорити',
                    'Це з тих, що залишається в голові на тиждень',
                    'Я б цьому фільму дав ще один шанс, навіть якщо чув про нього',
                    'Сюжет нерівний, але момент — топ. Терпи'
                ],
                horror: [
                    'Точно витримаєш? Я б у наушниках і зі світлом',
                    'Ну тримайся. І не вимикай світло о 3 ночі',
                    'Я попередив. Не дивись на самоті',
                    'Це не для слабких нервів. Я вже здригаюсь',
                    'Поруч когось посади. На всяк',
                    'Це той випадок, коли я б ховався під ковдрою',
                    'Хто кричатиме першим — ти чи я?'
                ],
                comedy: [
                    'Гарантую посмішку. Або повернемо... ні, не повернемо',
                    'Легеньке для душі. Можна під вечерю',
                    'Сміятимешся точно. Я перевірив',
                    'Не серйозно, але саме те, що треба',
                    'Якщо не сміявся — я не Picksy',
                    'Веселий — і це не банально, обіцяю'
                ],
                romance: [
                    'Якщо хочеш сльози — попався правильно',
                    'Ідеально на побачення. Або на «гладити кота»',
                    'Підготуй серветки. На всяк випадок',
                    'Любов і драма в одному. Ідеально',
                    'Якщо ти романтик — це для тебе',
                    'Я зворушусь разом з тобою, чесно'
                ],
                drama: [
                    'Готуйся подумати. Це не просто кіно',
                    'Сильна штука. Не для випадкового перегляду',
                    'Серйозна історія. Дай йому шанс',
                    'Після цього треба буде помовчати',
                    'Дивись з порожньою головою — інакше пропустиш',
                    'Це не швидкий перегляд. Сідай надовго'
                ],
                action: [
                    'Будуть вибухи. Я гарантую',
                    'Адреналін гарантовано. Чай не випадково',
                    'Динамічно і голосно. Колонки прикрути',
                    'Активний відпочинок для очей',
                    'Швидко, гучно, у яблучко',
                    'Кожні 10 хвилин щось вибухає. Ідеально'
                ],
                scifi: [
                    'Готуйся: мозок попрацює. Але це круто',
                    'Фантастика — моя слабкість. Дивись уважно',
                    'Якщо щось не зрозумієш — це нормально',
                    'Тут варто пересмотіти. Поверишь мені',
                    'Майбутнє, в яке хочеться чи ні',
                    'Розум плавиться — це частина шоу'
                ],
                anime: [
                    'Аніме на вечір — мудре рішення',
                    'Я б подивився ще раз. Класика!',
                    'Естетика, музика, історія. Все на місці',
                    'Сюжет може заплутати — це нормально',
                    'Дивись з субтитрами, я наполягаю',
                    'Якщо це не зайде — я з\u02bcїм свою плівку'
                ],
                doc: [
                    'Підготуй блокнот — буде цікаво',
                    'Документалка краща за половину серіалів. Перевірено',
                    'Розширить світогляд, обіцяю',
                    'Це з тих, що рекомендуєш потім усім',
                    'Дізнаєшся щось нове — або злякаєшся реальності'
                ],
                book: [
                    'Книжка — це довго, але це інвестиція в себе',
                    'Заварюй чай. Така книжка не біжить нікуди',
                    'Я б рекомендував з кавою на дощовий день',
                    'Закладку готуй. Це надовго',
                    'Це не на один вечір, скажу чесно',
                    'Перші 50 сторінок — терпи. Далі затягне'
                ],
                tv: [
                    'Серіал — це довго. Будь готовий до запою',
                    'Перший сезон зайде. Далі — побачимо',
                    'Якщо втягнешся — пропадеш на тиждень',
                    'Запасайся снеками. Це марафон',
                    'Скасуй плани на вечір. Дякуй мені потім',
                    'Сон цього тижня під загрозою'
                ]
            },
            // ─── Quiz (Archetype) lines
            quiz_intro: [
                'Я ще не знаю, який ти кіно-тип. Зараз розберемось',
                '12 питань — і я знатиму, з ким маю справу',
                'Готовий? Я обіцяю не плутати тебе',
                'Тиць — і я почну вгадувати твою кіно-душу'
            ],
            quiz_progress: [
                'Цікаво. Запам\u02bcятав',
                'Я тебе бачу',
                'Це багато про тебе говорить',
                'О, такого я не чекав',
                'Класична відповідь, любо-дорого',
                'Не очікував, але поважаю',
                'Нічого собі. Я це врахую',
                'Ти не з простих, я бачу',
                'Так-так-так, картинка складається'
            ],
            quiz_result: [
                'Ну ось! Я тепер знаю, чим тебе годувати',
                'Класно! Тепер мої підбірки будуть ще точніші',
                'Запам\u02bcятав. Чекай — буде кінотерапія за смаком',
                'Ось він, твій кіно-тип. Я фанат таких'
            ],
            // ─── Match (Compatibility) lines
            match_intro: [
                'Перевіримо ваші смаки? Я люблю такі історії',
                'Ну добре, давайте подивимось, хто кого зрозуміє',
                'Кіно-сумісність — це серйозно. Я суддя суворий',
                'Готовий бути арбітром вашого вечора'
            ],
            match_high: [
                'Ого. Ви двоє — це готовий кіно-дует',
                'Я б платив за квитки на ваш вечір',
                'Така сумісність — рідкість. Беріть і дивіться',
                'Вмієте обирати разом. Я заздрю'
            ],
            match_mid: [
                'Не ідеально, але є робота. Я підкажу спільне',
                'Половина — це теж непогано. Я знайду компроміс',
                'Все ще можна врятувати. Дам пораду'
            ],
            match_low: [
                'Цікаво. У вас зовсім різні всесвіти',
                'Складна пара. Але саме тому я тут',
                'Гммм. Дивіться різне і обговорюйте — пропоную'
            ],
            // ─── Wordle / Game lines
            wordle_intro: [
                'Гадаємо фільм за 6 спроб? Поїхали',
                'Я вже знаю відповідь, але не скажу',
                'Сьогоднішня загадка — складна, попереджаю',
                'Тримайся. Я вболіваю за тебе'
            ],
            wordle_close: [
                'Майже! Ще трошки',
                'Спекотно! Не зупиняйся',
                'Ти близько. Я кивну, як буде холодніше',
                'Думай у тому ж напрямку'
            ],
            wordle_far: [
                'Ні-ні-ні, не той напрямок',
                'Холодно. Спробуй щось зовсім інше',
                'Це не воно. Шукай далі',
                'Хм, я б на твоєму місці поміняв стратегію'
            ],
            wordle_win: [
                'Молодець! Я знав, що ти впораєшся',
                'Чисто! Я тебе недооцінив',
                'Геній. Серйозно',
                'Я б тобі поплескав, але рук немає'
            ],
            wordle_lose: [
                'Ну нічого. Завтра новий шанс',
                'Цей був складний. Я б теж не вгадав',
                'Бувай, реванш у нас завтра',
                'Не журись, я вірю в тебе'
            ],
            game_intro: [
                'Гру починаємо? Я обираю фільм, ви — здогадуєтесь',
                'Готові? Я не лагідний суддя',
                'Йду. Скоро буде фільм'
            ],
            game_win: [
                'Чисто! Дивно, як ти це робиш',
                'Топово. Серйозно вражений',
                'Я в шоці. Реально. Молодець'
            ],
            game_lose: [
                'Ну нічого. Бувало складніше',
                'Я думав, ти ближче. Нічого, наступного разу',
                'Тримайся, ще все попереду'
            ],
            // ─── Profile / Achievements
            profile_intro: [
                'Це твій кіно-паспорт. Я знаю про тебе більше, ніж думаєш',
                'Тут все, що ми разом проживали. Гарне місце'
            ],
            profile_milestone: [
                'Це круто. Я це запам\u02bcятаю',
                'Поважаю. Не кожен дійде',
                'Молодець. Я не лестощу'
            ],
            // ─── Gift / Match
            gift_intro: [
                'Подарунок? Я допоможу обрати так, щоб запам\u02bcятались',
                'Гарна ідея. Я люблю такі жести',
                'Я підкажу, що подарувати — головне не помилитись'
            ],
            // ─── FAQ / settings
            faq_intro: [
                'Питання? Я тут. Звертайся',
                'Що цікавить? Спитай, я не кусаюсь',
                'Я тебе вислухаю, навіть якщо не зможу відповісти'
            ],
            // ─── offline
            offline: [
                'Мережі нема, але я тут. Поверни її — і ми продовжимо',
                'Зачекаю. Я терплячий',
                'Без інтернету я мало що можу, але я тут поруч'
            ],
            // ─── FAB — random tickle phrases when user clicks the floating Picksy
            fab_tickle: [
                'Гей. Що цікавить?',
                'Лоскотно',
                'Я Picksy. Що дивимось сьогодні?',
                'Тиць — і я з\u02bcявляюсь. Як джин',
                'Чим допомогти?',
                'Я тут. Жени настрій',
                'Я завжди на зв\u02bcязку',
                'Не клікай мене даремно — образжусь. Жартую',
                'Тицяй ще. Я тут навічно',
                'Скажи що-небудь — я не люблю мовчанку',
                'Я як проектор: натиснув — увімкнув',
                'Тиць! Не люблю, як підглядають',
                'Привіт. Я обираю — ти дивишся. Класична схема',
                'Я вгадую швидше, ніж ти думаєш'
            ],
            // ─── interaction count milestones (Easter eggs)
            milestone_10: [
                'О, ти кликаєш мене вже 10 разів. Я це помітив 👀'
            ],
            milestone_50: [
                '50 кліків. Я починаю думати, що ти мене любиш'
            ],
            milestone_100: [
                'Сотка. Це вже серйозно. Дякую за компанію 💜'
            ],
            // ─── Long-term recall lines (used by recall())
            recall_horror_lover: [
                'Бачу, тобі заходять страшилки. Маю для тебе щось особливе',
                'Знов хорор? Я звик до твого смаку'
            ],
            recall_comedy_lover: [
                'Знову комедія? Ти знаєш, як себе побалувати',
                'Я бачу, ти любиш сміятись. Це круто'
            ],
            recall_romance_lover: [
                'Любитель сердечних історій. Я готую щось особливе',
                'Знов романтика? Серветки під рукою?'
            ],
            recall_book_lover: [
                'Ти любиш книги. Це рідкість. Я ціную',
                'Книжки — твоє. Гарний смак'
            ],
            ai_intro: 'Picksy каже',
            label: 'AI-куратор Picksy',
            greet_name: 'Я Picksy',
            tap_hint: 'Тицьни мене ↑',
            close_label: 'Закрити'
        },
        en: {
            hero: {
                morning: [
                    'Hey. Half-awake but already hunting a film for you ☕',
                    'Morning. What are we watching — something light?',
                    'I\'m Picksy. A film-reel with attitude. What feels right today?',
                    'Slightly sleepy, but my taste is sharp. Tell me the vibe',
                    'I\'m on caffeine duty. Throw me a mood',
                    'Good morning! Today I\'m in careful-with-triggers mode',
                    'Coffee on — I\'m already flipping through the catalog',
                    'Still early, but I\'m ready. Toss me a mood',
                    'Morning is for quiet cinema. Or loud — your call',
                    'Hi hi. Long week, short film. Deal?',
                    'I previewed the catalog last night. Got picks for you',
                    'Let\'s wake up together. Genre — and I do the rest'
                ],
                day: [
                    'Hi! I\'m Picksy. Tell me your mood — I\'ll find the perfect pick',
                    'What are we watching today? Just say anything — I\'ll get it',
                    'I\'m here so you don\'t scroll for an hour. What\'s the vibe?',
                    'Lunchtime — perfect for a fresh discovery',
                    'On the clock. One pick — done',
                    'Hi. Fresh coffee, fresh catalog, fresh mood. Let\'s go',
                    'Daytime Picksy reporting. What are we watching?',
                    'Quiet noon — good time to find something new',
                    'I already sorted what\'ll land for you. Give me a mood',
                    'Mid-day cinema is also legit. Don\'t hide',
                    'Quick pick — before your coffee goes cold',
                    'I have a few surprises ready. Throw the prompt'
                ],
                evening: [
                    'Evening — prime film time. What shall I pull off the shelf?',
                    'I\'m wide awake. Tell me your mood — picks in 5 seconds',
                    'Just got home? Sit down, I already have an idea',
                    'Dim the lights, we\'re picking tonight\'s film',
                    'Betting you need something atmospheric tonight',
                    'Time for Picksy mode. Film, series or book?',
                    'Long day — let the night be a treat. What\'s the vibe?',
                    'Blanket, tea, film. I pick, you tell me the mood',
                    'Evening shift Picksy. Got a few hidden gems',
                    'No filler shows. Got something real for you',
                    'Dim the lights, put the phone away. Let\'s start',
                    'Curator mode on. Tell me the vibe — I\'ll deliver'
                ],
                night: [
                    'Can\'t sleep? Got an idea. Tell me what you want — I never sleep',
                    'Midnight session? I\'m in. What genre?',
                    'Picksy night-shift, reporting. What are we watching?',
                    'World\'s asleep — we\'re picking films. Classic',
                    'I work best after midnight. Give me a mood',
                    'You\'re one of us. Something quiet or loud tonight?',
                    'Insomnia is my hour. Got a fall-asleep film AND a shake-you-up one',
                    'At this hour I curate especially honestly',
                    'Night isn\'t scary. I\'m here. And so is one cool film',
                    'Silence, screen, and you. Mood — I\'ll match it',
                    'Midnight pick — extra personal. Tell me'
                ],
                returning: [
                    'Hey, familiar face. Welcome back 👀',
                    'You\'re back! I remembered you',
                    'There you are. I was warming the catalog',
                    'Nice to see you again. Picking?'
                ]
            },
            loading: [
                'Flipping through the catalog...',
                'Sorting reels on the shelf...',
                'Cross-checking reviews...',
                'Weighing the options...',
                'Almost got something special...',
                'One sec — picking the best one...',
                'Hmm, this one\'s good but I want better',
                'Thinking thinking thinking...',
                'Checking if I already recommended this',
                'Searching for something you haven\'t seen',
                'Remembering what you liked before...',
                'This is either a masterpiece or a flop — let me check',
                'Asked my reel colleagues, verifying...',
                'Soon. Don\'t leave',
                'It\'s either hit or miss. Have to be sure',
                'Yep, this genre is your weakness',
                'Checking if it\'s available in your country',
                'I smell a good film',
                'If this misses I\'ll be upset. Kidding',
                'Almost — I\'m a perfectionist',
                'Checking ratings, picking off the beaten path',
                'One sec — this is delicate work',
                'Keep popcorn ready',
                'Found a candidate. Now a backup',
                'Thinking like a critic, picking like a friend',
                'Almost there. I don\'t do rushed picks',
                'Running it through my old projector',
                'Shh, I\'m chasing an idea',
                'Won\'t be long — don\'t bother the editor',
                'Tuning into the mood, the weather and your karma',
                'The catalog is chatty today — listening',
                'Assembling the perfect frame for you',
                'I\'m not rushing — rushing ruins taste',
                'One sec — checking against your past picks',
                'I have one candidate, but I want a wider net',
                'Weighing tone, pace, and your energy',
                'Finding a story you wouldn\'t expect',
                'Making sure this recommendation hasn\'t repeated',
                'Picking something you couldn\'t have come up with yourself',
                'I almost caught the right frame',
                'A bit more — frame\'s not quite done',
                'Coming up. I don\'t do half-measures',
                'Engaging subtle-mood mode'
            ],
            loading_movie: [
                'Inspecting the print for splices...',
                'Spinning the reel — hunting your film',
                'Replaying the trailer in my head, double-checking',
                'Has this frame ever lit up your screen?',
                'Finding a director who\'ll find your heart',
                'Digging through classics AND fresh drops at once',
                'Checking if the film keeps pace to the credits',
                'Picking the score you\'ll feel tonight',
                'I read critics — then do it my way',
                'Neutral for now. The "whoa" is incoming',
                'Picking a film proud of its credits — chances are good',
                'Checking if the frame still glows at night',
                'Hunting a film without a predictable ending',
                'Mentally tuning the sound — so it lands for you',
                'One sec — picking the film, not the content',
                'Hunting a film where the pause is part of the story',
                'Cooking up a version where you don\'t reach for the phone',
                'Either a masterpiece or a discussion-starter. Verifying',
                'Imagining you in the theater — will it land?',
                'Fitting the runtime into your evening',
                'Looking for a film without filler',
                'Making sure the ending doesn\'t ruin it',
                'As I scroll — will you want a rewatch?',
                'I smell popcorn — must be close',
                'Tonight is your cine-story. Picking the opening scene',
                'One more minute — and you get a mood-film',
                'Comparing with what you loved before',
                'This will become a favorite or a meme. Verifying'
            ],
            loading_tv: [
                'Sanity-checking the pilot — worth recommending?',
                'Running through the first three episodes — checking pace',
                'Plot held tight or stretched? Verifying',
                'Looking for a show you won\'t look away from',
                'Estimating how many seasons you can take',
                'Making sure the finale doesn\'t betray you',
                'Saying nothing yet — but this is your new addiction',
                'Matching the show to your sleep schedule (apologies in advance)',
                'Hunting characters worth living with',
                'A show with no filler episode? Hard. I\'ll find it',
                'Checking if "just one episode" is even possible (spoiler: no)',
                'Looking for a world worth returning to',
                'One sec — picking drama, not chewing gum',
                'This actor will make your evening. Maybe...',
                'Picking a show that doesn\'t need a Reddit recap',
                'You asked for a series — I\'m picking a world to dive into',
                'Looking for a show you\'ll retell to friends',
                'Checking if you can survive a cliffhanger',
                'It will hook you or you\'ll say "thanks, no". Verifying',
                'One sec — cross-referencing audience and my own taste'
            ],
            loading_book: [
                'Flipping covers — looking for your book',
                'Checking if you\'ll survive the first 50 pages',
                'Hunting a book you won\'t want to put down',
                'Checking the prose — not the kind you fall asleep on',
                'Cross-checking reviews with my own nose',
                'This one\'s read with underlines. Verifying',
                'Looking for a book that shifts a view, even slightly',
                'Checking the translation (a bad one wrecks everything)',
                'I smell new pages — and a little coffee',
                'Matching the book to your mood, not the bestseller list',
                'Making sure the ending doesn\'t drain the journey',
                'Looking for a book where characters live, not schemes',
                'Almost there — you\'ll be flipping pages until 2am',
                'You\'ll love it or hate it — no middle ground. Verifying',
                'Looking for a book you\'ll return to a year later',
                'Checking that the language sings, not just sits',
                'Not a book — a cinema in your head. Looking for that',
                'Picking one whose first paragraph kicks like a drum',
                'One sec — comparing to your saved list',
                'If you don\'t binge-read it, I\'m not Picksy'
            ],
            empty_saved: [
                'Come on, let\'s pick something — I missed you',
                'Empty for now. Save what you like — I\'ll remember',
                'Saved is your personal shelf. Currently empty.',
                'No shame ❤️ — just hit Save on a film you like',
                'I\'m waiting here. Save your first one — I\'ll learn your taste',
                'Without saves I can\'t guess — let\'s start',
                'Nothing saved means I can\'t read your taste. Help me 🙏'
            ],
            empty_collections: [
                'No collections yet. Create one — I\'ll help fill it',
                'A collection is your private cinema. Build one!',
                'This is your cine-universe. Empty for now. Fix that'
            ],
            ai_commentary: {
                generic: [
                    'Here\'s my pick. Maybe not a first-date film, but you do you',
                    'Pick is ready. If it misses, hit «More» — I won\'t be offended',
                    'Verified: I\'d watch it myself',
                    'Tip: popcorn first, watch second',
                    'Wow. Serious choice for the evening',
                    'Watch closely — details matter here',
                    'Best watched with someone — you\'ll want to talk after',
                    'One of those that stays with you for a week',
                    'I\'d give this another chance, even if you heard about it',
                    'Story is uneven, but the moment — top tier. Trust me'
                ],
                horror: [
                    'Sure you can take it? Headphones, lights on',
                    'Brace yourself. Don\'t kill the lights at 3am',
                    'I warned you. Not for solo viewing',
                    'Not for weak nerves. I\'m already flinching',
                    'Get someone next to you. Just in case',
                    'This is hide-under-blanket level',
                    'Who screams first — you or me?'
                ],
                comedy: [
                    'A smile is guaranteed. Or your money back... nope',
                    'Easy for the soul. Pair with dinner',
                    'You will laugh. I checked',
                    'Not serious, exactly what you need',
                    'If you don\'t laugh, I\'m not Picksy',
                    'Fun without being cheap — promise'
                ],
                romance: [
                    'Tears? You landed in the right spot',
                    'Date-night perfect. Or «pet the cat» night',
                    'Stock the tissues, just in case',
                    'Love and drama, one package. Perfect',
                    'If you\'re a romantic, this one\'s yours',
                    'I\'ll tear up alongside you, honestly'
                ],
                drama: [
                    'Ready to think? This isn\'t just a film',
                    'Heavy stuff. Don\'t watch by accident',
                    'A serious story. Give it a chance',
                    'After this you\'ll want a moment of silence',
                    'Watch with an empty head — otherwise you\'ll miss it',
                    'Not a quick watch. Sit in for the long haul'
                ],
                action: [
                    'Explosions incoming. Guaranteed',
                    'Adrenaline locked in. Tea? Not the moment',
                    'Loud and fast. Turn the volume down a notch',
                    'An active workout for your eyes',
                    'Fast, loud, on target',
                    'Something blows up every 10 minutes. Perfect'
                ],
                scifi: [
                    'Brain workout ahead. But it\'s great',
                    'Sci-fi is my weakness. Watch closely',
                    'If something feels off — that\'s normal',
                    'Worth rewatching. Trust me',
                    'A future you\'ll want — or won\'t',
                    'Mind melts — that\'s part of the show'
                ],
                anime: [
                    'Anime tonight — wise call',
                    'I\'d rewatch this. A classic!',
                    'Aesthetic, score, story. Full package',
                    'Plot may twist — that\'s fine',
                    'Watch with subtitles, I insist',
                    'If this misses I\'ll eat my own reel'
                ],
                doc: [
                    'Grab a notebook — this gets interesting',
                    'Docs beat half the series out there. Trust me',
                    'Mind-expander, I promise',
                    'One of those you\'ll recommend after',
                    'You\'ll learn — or get scared of reality'
                ],
                book: [
                    'A book is a slow burn — and that\'s the point',
                    'Brew tea. This one doesn\'t rush',
                    'Pair with coffee on a rainy day',
                    'Get a bookmark ready. It\'s long',
                    'Not a one-night read, honestly',
                    'First 50 pages — bear with it. Then it grips'
                ],
                tv: [
                    'A series is a commitment. Get ready to binge',
                    'Season 1 will hook you. We\'ll see about season 2',
                    'Once you start — say goodbye to the week',
                    'Stock snacks. It\'s a marathon',
                    'Cancel tonight\'s plans. Thank me later',
                    'Your sleep this week is in danger'
                ]
            },
            quiz_intro: [
                'I don\'t know your cine-type yet. Let\'s find out',
                '12 questions — and I\'ll know who I\'m dealing with',
                'Ready? I promise not to confuse you',
                'Tap — and I\'ll start guessing your film soul'
            ],
            quiz_progress: [
                'Interesting. Noted',
                'I see you',
                'That tells me a lot about you',
                'Oh, didn\'t expect that',
                'Classic answer, love it',
                'Didn\'t see it coming, respect',
                'Whoa. I\'ll factor that in',
                'You\'re not a simple one, I see',
                'OK OK OK, the picture is forming'
            ],
            quiz_result: [
                'There we go! Now I know what to feed you',
                'Nice! My picks will be even sharper now',
                'Saved. Get ready — cine-therapy by taste',
                'Here\'s your cine-type. I love these'
            ],
            match_intro: [
                'Testing your tastes? I love stories like this',
                'OK then, let\'s see who gets whom',
                'Cine-compatibility is serious. I\'m a strict judge',
                'Ready to referee your night'
            ],
            match_high: [
                'Wow. You two are a ready-made cine-duo',
                'I\'d pay for tickets to your movie night',
                'This kind of match is rare. Take it and watch',
                'You know how to pick together. I\'m jealous'
            ],
            match_mid: [
                'Not ideal, but workable. I\'ll suggest common ground',
                'Half is not bad. I\'ll find compromise',
                'It can still be saved. Got tips'
            ],
            match_low: [
                'Interesting. You\'re in totally different universes',
                'Tough pair. That\'s why I\'m here',
                'Hmm. Watch different things and discuss — that\'s my suggestion'
            ],
            wordle_intro: [
                'Guess the film in 6 tries? Let\'s go',
                'I already know the answer, but I won\'t tell',
                'Today\'s puzzle is tough, fair warning',
                'Hang in. I\'m rooting for you'
            ],
            wordle_close: [
                'Almost! Just a bit more',
                'Hot! Keep going',
                'You\'re close. I\'ll nod when it cools down',
                'Think in that direction'
            ],
            wordle_far: [
                'Nope, wrong direction',
                'Cold. Try something completely different',
                'Not it. Keep looking',
                'I\'d change strategy if I were you'
            ],
            wordle_win: [
                'Nice! I knew you\'d crack it',
                'Clean! I underestimated you',
                'Genius. Seriously',
                'I\'d clap, but I have no hands'
            ],
            wordle_lose: [
                'No worries. New shot tomorrow',
                'This one was hard. I\'d miss too',
                'See you, rematch tomorrow',
                'Don\'t sweat it, I believe in you'
            ],
            game_intro: [
                'Starting the game? I pick the film, you guess',
                'Ready? I\'m not a soft judge',
                'Coming up. Film soon'
            ],
            game_win: [
                'Clean! How do you do that',
                'Top notch. Genuinely impressed',
                'I\'m shocked. Really. Well done'
            ],
            game_lose: [
                'No worries. Tougher rounds happen',
                'I thought you were closer. Next time',
                'Hang in, more rounds ahead'
            ],
            profile_intro: [
                'This is your cine-passport. I know more about you than you think',
                'Everything we\'ve been through. Nice spot'
            ],
            profile_milestone: [
                'That\'s cool. I\'ll remember',
                'Respect. Not many make it here',
                'Well done. No flattery'
            ],
            gift_intro: [
                'A gift? I\'ll help you pick the memorable kind',
                'Nice idea. I love gestures like this',
                'I\'ll suggest a gift — let\'s not miss'
            ],
            faq_intro: [
                'Questions? I\'m here. Ask away',
                'What interests you? Ask — I don\'t bite',
                'I\'ll hear you out, even if I can\'t answer'
            ],
            offline: [
                'No network, but I\'m here. Bring it back — and we continue',
                'I\'ll wait. I\'m patient',
                'Without internet I can\'t do much, but I\'m around'
            ],
            fab_tickle: [
                'Hey. What\'s up?',
                'Tickles',
                'I\'m Picksy. Watching anything today?',
                'Tap and I appear. Like a genie',
                'How can I help?',
                'I\'m here. Throw me a mood',
                'I\'m always on',
                'Don\'t click me for nothing — I\'ll be offended. Kidding',
                'Tap again. I\'m here forever',
                'Say something — I don\'t do silence',
                'I\'m like a projector: pressed me — turned me on',
                'Tap! I don\'t like being watched',
                'Hi. I pick — you watch. Classic setup',
                'I guess faster than you think'
            ],
            milestone_10: [
                'Oh, you\'ve clicked me 10 times. I noticed 👀'
            ],
            milestone_50: [
                '50 clicks. Starting to think you like me'
            ],
            milestone_100: [
                'A hundred. That\'s serious. Thanks for the company 💜'
            ],
            recall_horror_lover: [
                'I see, you love scary stuff. Got something special for you',
                'Horror again? I know your taste'
            ],
            recall_comedy_lover: [
                'Comedy again? You know how to treat yourself',
                'I see you like to laugh. That\'s cool'
            ],
            recall_romance_lover: [
                'A heart-story lover. Cooking something special',
                'Romance again? Tissues ready?'
            ],
            recall_book_lover: [
                'You love books. That\'s rare. Respect',
                'Books are your thing. Good taste'
            ],
            ai_intro: 'Picksy says',
            label: 'Picksy AI curator',
            greet_name: 'I\'m Picksy',
            tap_hint: 'Tap me ↑',
            close_label: 'Close'
        }
    };

    function lang() {
        try {
            if (global.I18N && global.I18N.current) return global.I18N.current === 'en' ? 'en' : 'uk';
        } catch (e) {}
        try {
            var l = (localStorage.getItem('pfm_lang') || '').toLowerCase();
            return l === 'en' ? 'en' : 'uk';
        } catch (e) { return 'uk'; }
    }

    function pick(arr) {
        if (!arr || !arr.length) return '';
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ===========================================================
    // PROCEDURAL PHRASE GENERATOR
    // -----------------------------------------------------------
    //   Picksy doesn't just read from a fixed PHRASES list — he also
    //   *invents* lines on the fly from small token banks and a few
    //   sentence templates. This keeps the bot feeling fresh even on
    //   long sessions where the static pool would start repeating.
    //
    //   Public API:
    //     Picksy.generate(bucket, opts)   -> string  (one synthetic line)
    //
    //   Where bucket is one of:
    //     hero | loading | loading_movie | loading_tv | loading_book |
    //     fab_tickle | empty_saved | ai_generic
    //
    //   Templates are simple {token} interpolations. Each token resolves
    //   from GEN_BANKS[lang][tokenName] (or falls back to GEN_BANKS.uk if
    //   the language doesn't define it). The result is plugged into
    //   phrase() so the pool of options expands automatically.
    // ===========================================================
    var GEN_BANKS = {
        uk: {
            verb: ['шукаю', 'обираю', 'підбираю', 'звіряюсь', 'перевіряю', 'готую', 'зважую', 'досліджую', 'фільтрую', 'сортую'],
            verb2: ['тримаю', 'ловлю', 'майструю', 'звіряю', 'збираю'],
            obj_movie: ['фільм', 'стрічку', 'історію', 'кіно під настрій', 'кадр', 'фільм-настрій', 'кіно вечора', 'фільм без води'],
            obj_tv: ['серіал', 'шоу', 'історію на сезон', 'шоу без води', 'серіал, в який хочеться повернутись', 'шоу, що цитуватимуть'],
            obj_book: ['книгу', 'роман', 'історію', 'текст, що дихає', 'книгу-кінотеатр у голові', 'книгу до самого ранку'],
            obj_any: ['рекомендацію', 'підбір', 'варіант', 'історію', 'настрій'],
            adj: ['чесний', 'тонкий', 'без води', 'з характером', 'без передбачуваного фіналу', 'смачний', 'живий', 'не нудний', 'теплий', 'настроєвий'],
            mood: ['у настрої куратора', 'у бойовому ритмі', 'тихий і уважний', 'у фокусі', 'обережно з тригерами', 'на хвилі смаку'],
            tail: ['Зачекай 5 секунд', 'Тримай', 'Ще секунду', 'Поїхали', 'Майже', 'Майже готово', 'Все буде', 'Я близько', 'Дай мить'],
            greet_open: ['Привіт', 'Гей', 'Тиць', 'Я тут', 'Слухаю'],
            time_noun: ['вечір', 'ранок', 'ніч', 'день'],
            sense: ['чую', 'бачу', 'відчуваю']
        },
        en: {
            verb: ['picking', 'searching', 'sorting', 'cross-checking', 'verifying', 'preparing', 'weighing', 'tuning', 'filtering', 'curating'],
            verb2: ['holding', 'catching', 'crafting', 'sensing', 'assembling'],
            obj_movie: ['a film', 'a story', 'a frame', 'a mood-film', 'tonight\'s film', 'a film with no filler'],
            obj_tv: ['a series', 'a show', 'a season-long story', 'a show with no filler', 'a show worth returning to', 'a show people quote'],
            obj_book: ['a book', 'a novel', 'a story', 'a text that breathes', 'a head-cinema book', 'a book for the long night'],
            obj_any: ['a pick', 'a rec', 'an option', 'a story', 'a vibe'],
            adj: ['honest', 'subtle', 'no-filler', 'with character', 'with no predictable ending', 'rich', 'alive', 'not dull', 'warm', 'mood-driven'],
            mood: ['in curator mode', 'in fighting rhythm', 'quiet and careful', 'in focus', 'easy on the triggers', 'riding taste'],
            tail: ['Hang on 5 sec', 'Hold tight', 'One sec', 'Let\'s go', 'Almost', 'Almost done', 'Coming up', 'Close', 'Give me a beat'],
            greet_open: ['Hey', 'Hi', 'Tap', 'I\'m here', 'Listening'],
            time_noun: ['evening', 'morning', 'night', 'day'],
            sense: ['I smell', 'I see', 'I feel']
        }
    };

    var GEN_TEMPLATES = {
        loading: [
            '{verb} {adj} {obj_any}. {tail}.',
            '{verb} {obj_any}. {tail}.',
            'Хвилинку — {verb} {obj_any}',
            '{tail}. Уже {verb} тобі {obj_any}',
            'Я {mood}. {verb} {obj_any}',
            '{sense} вдалу підбірку. {verb2} ще секунду'
        ],
        loading_en: [
            '{verb} {adj} {obj_any}. {tail}.',
            '{verb} {obj_any}. {tail}.',
            'One sec — {verb} {obj_any}',
            '{tail}. Already {verb} you {obj_any}',
            'I\'m {mood}. {verb} {obj_any}',
            '{sense} a solid pick. {verb2} one more sec'
        ],
        loading_movie: [
            '{verb} {adj} {obj_movie}. {tail}.',
            'Хвилинку — {verb} {obj_movie}',
            '{tail}. Майже знайшов {obj_movie}',
            'Я {mood}. {verb} тобі {obj_movie}',
            'Це не просто {obj_movie}, це настрій. {tail}'
        ],
        loading_movie_en: [
            '{verb} {adj} {obj_movie}. {tail}.',
            'One sec — {verb} {obj_movie}',
            '{tail}. Almost have {obj_movie}',
            'I\'m {mood}. {verb} you {obj_movie}',
            'This isn\'t just {obj_movie}, it\'s a mood. {tail}'
        ],
        loading_tv: [
            '{verb} {adj} {obj_tv}. {tail}.',
            'Готую {obj_tv}. {tail}.',
            '{tail}. Уже {verb} {obj_tv}',
            'Я {mood}. {verb} тобі {obj_tv}'
        ],
        loading_tv_en: [
            '{verb} {adj} {obj_tv}. {tail}.',
            'Cooking {obj_tv}. {tail}.',
            '{tail}. Already {verb} {obj_tv}',
            'I\'m {mood}. {verb} you {obj_tv}'
        ],
        loading_book: [
            '{verb} {adj} {obj_book}. {tail}.',
            'Хвилинку — {verb} {obj_book}',
            'Я {mood}. {verb} тобі {obj_book}',
            'Шукаю {obj_book}, у яку хочеться повернутись. {tail}'
        ],
        loading_book_en: [
            '{verb} {adj} {obj_book}. {tail}.',
            'One sec — {verb} {obj_book}',
            'I\'m {mood}. {verb} you {obj_book}',
            'Hunting {obj_book} worth returning to. {tail}'
        ],
        hero: [
            '{greet_open}. Сьогодні я {mood}. Скажи настрій',
            '{greet_open}. {time_noun} — чудовий час для {obj_any}',
            '{greet_open}. Маю кілька варіантів — {verb} саме той, що зайде',
            'Я тут, {mood}. Жени запит — {verb} підбір'
        ],
        hero_en: [
            '{greet_open}. Today I\'m {mood}. Tell me the vibe',
            '{greet_open}. {time_noun} — perfect for {obj_any}',
            '{greet_open}. Got a few options — {verb} the right one',
            'I\'m here, {mood}. Throw a prompt — {verb} a pick'
        ],
        fab_tickle: [
            '{greet_open}. Що цікавить?',
            'Тиць! Я {mood}',
            '{greet_open}. Жени настрій',
            'Я {mood}. Кажи, що треба'
        ],
        fab_tickle_en: [
            '{greet_open}. What\'s up?',
            'Tap! I\'m {mood}',
            '{greet_open}. Toss me a mood',
            'I\'m {mood}. Tell me what you need'
        ],
        empty_saved: [
            'Тут поки порожньо. {verb} разом — давай збережемо перший {obj_any}',
            'Без збережених я {mood}. Допоможи мені вивчити твій смак',
            'Натисни ❤️ на чомусь — і я {verb} точніше'
        ],
        empty_saved_en: [
            'Empty for now. Let\'s {verb} together — save the first {obj_any}',
            'With nothing saved I\'m {mood}. Help me learn your taste',
            'Hit ❤️ on something — I\'ll {verb} better'
        ],
        ai_generic: [
            'Ось {adj} {obj_any}. Якщо не зайде — натисни «Ще»',
            'Я {mood} під час вибору. Тримай {obj_any}',
            'Мій {obj_any} для тебе. {tail}'
        ],
        ai_generic_en: [
            'Here\'s {adj} {obj_any}. If it misses — hit "Again"',
            'I was {mood} during the pick. Hold {obj_any}',
            'My {obj_any} for you. {tail}'
        ]
    };

    function _bankPick(lang, name) {
        var bank = (GEN_BANKS[lang] && GEN_BANKS[lang][name]) || GEN_BANKS.uk[name] || [];
        if (!bank.length) return '';
        return bank[Math.floor(Math.random() * bank.length)];
    }

    function _capSentences(s) {
        // Capitalise the very first letter and the letter after every sentence
        // terminator (. ? ! followed by whitespace). Leaves all other casing
        // intact so e.g. "AI" stays "AI".
        if (!s) return s;
        return s.replace(/(^|[.?!]\s+)([\p{Ll}])/gu, function (_, sep, ch) {
            return sep + ch.toLocaleUpperCase();
        });
    }

    function _fillTemplate(tpl, lang) {
        var filled = tpl.replace(/\{(\w+)\}/g, function (_, name) {
            return _bankPick(lang, name) || ('{' + name + '}');
        });
        return _capSentences(filled);
    }

    // Generate ONE synthetic line for a given bucket.
    function generate(bucket, opts) {
        opts = opts || {};
        var langCode = opts.lang || lang();
        var key = bucket;
        // language-specific template lookup: bucket_en falls back to bucket
        var enKey = bucket + '_en';
        var tpls = (langCode === 'en' ? (GEN_TEMPLATES[enKey] || GEN_TEMPLATES[bucket]) : GEN_TEMPLATES[bucket]) || [];
        if (!tpls.length) return '';
        var tpl = tpls[Math.floor(Math.random() * tpls.length)];
        return _fillTemplate(tpl, langCode);
    }

    // Generate N unique synthetic lines for a bucket (best-effort).
    function generateMany(bucket, count, opts) {
        var out = [], seen = {}, tries = 0;
        var max = Math.max(1, count || 5);
        while (out.length < max && tries < max * 4) {
            tries++;
            var line = generate(bucket, opts);
            if (line && !seen[line]) { seen[line] = 1; out.push(line); }
        }
        return out;
    }

    // -----------------------------------------------------------
    // Anti-repeat picker.
    //   - Tracks the last N lines we showed per logical bucket (e.g.
    //     'loading_movie', 'hero_morning', 'ai_commentary.horror') and
    //     never returns one of them as the next pick.
    //   - Bucket history size auto-adapts to the pool size: it tries to
    //     remember roughly 70% of the pool so big arrays cycle naturally
    //     while tiny arrays don't starve.
    //   - If the caller passes the same array twice in a row, we still
    //     guarantee the new pick is different from the previous one.
    // -----------------------------------------------------------
    var _recentLines = {};
    function pickFresh(arr, bucket) {
        if (!arr || !arr.length) return '';
        if (arr.length === 1) return arr[0];
        var key = bucket || '_default';
        var hist = _recentLines[key] || (_recentLines[key] = []);
        var maxHist = Math.max(1, Math.min(arr.length - 1, Math.floor(arr.length * 0.7)));
        var fresh = [];
        for (var i = 0; i < arr.length; i++) {
            if (hist.indexOf(arr[i]) === -1) fresh.push(arr[i]);
        }
        var chosen;
        if (fresh.length) {
            chosen = fresh[Math.floor(Math.random() * fresh.length)];
        } else {
            // every line was recently used — drop the oldest, pick from full
            hist.length = 0;
            chosen = arr[Math.floor(Math.random() * arr.length)];
        }
        hist.push(chosen);
        while (hist.length > maxHist) hist.shift();
        return chosen;
    }

    function timeBucket() {
        var h = new Date().getHours();
        if (h < 6)  return 'night';
        if (h < 12) return 'morning';
        if (h < 18) return 'day';
        if (h < 23) return 'evening';
        return 'night';
    }

    function moodForBucket(b) {
        if (b === 'morning') return 'tired';
        if (b === 'evening') return 'excited';
        if (b === 'night')   return 'wink';
        return 'happy';
    }

    // ===========================================================
    // MEMORY MODULE — local + optional account-based sync
    // ===========================================================
    var MEMORY_KEY = 'picksy_mascot_memory';
    var DEFAULT_MEMORY = {
        v: 1,
        firstSeen: 0,       // ms epoch
        lastSeen: 0,        // ms epoch
        visits: 0,          // total page-loads
        clicks: 0,          // total mascot interactions
        picks: 0,           // total recommendations consumed
        likedGenres: {},    // genre tag -> count
        recentItems: [],    // last 20 picked items (title/type)
        userName: '',       // user-provided name (free-text input via FAB)
        nickname: '',       // Picksy's own nickname for the user
        moodHints: [],      // last 10 detected mood inputs
        synced: false       // last sync state with backend
    };

    function readMemory() {
        try {
            var raw = localStorage.getItem(MEMORY_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_MEMORY));
            var obj = JSON.parse(raw);
            return Object.assign({}, DEFAULT_MEMORY, obj || {});
        } catch (e) {
            return JSON.parse(JSON.stringify(DEFAULT_MEMORY));
        }
    }

    function writeMemory(m) {
        try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch (e) {}
    }

    function memoryGet() { return readMemory(); }

    function memorySet(partial) {
        var m = readMemory();
        Object.keys(partial || {}).forEach(function (k) { m[k] = partial[k]; });
        m.lastSeen = Date.now();
        writeMemory(m);
        scheduleSync();
        return m;
    }

    function memoryAddPick(item, type) {
        var m = readMemory();
        m.picks = (m.picks || 0) + 1;
        var title = item && (item.title || item.name) || '';
        if (title) {
            m.recentItems = (m.recentItems || []).slice(-19);
            m.recentItems.push({ t: title, k: type || 'movie', at: Date.now() });
        }
        // Tally genre interest
        var genres = (item && item.genre_ids) || [];
        var bucket = inferCategory(item, type);
        if (bucket && bucket !== 'generic') {
            m.likedGenres = m.likedGenres || {};
            m.likedGenres[bucket] = (m.likedGenres[bucket] || 0) + 1;
        }
        m.lastSeen = Date.now();
        writeMemory(m);
        scheduleSync();
        return m;
    }

    function memoryBump(field, by) {
        var m = readMemory();
        m[field] = (m[field] || 0) + (by || 1);
        m.lastSeen = Date.now();
        writeMemory(m);
        scheduleSync();
        return m;
    }

    // Recall a contextual line based on memory (returns null when nothing fits)
    function memoryRecall() {
        var m = readMemory();
        var L = PHRASES[lang()];
        if (!m.likedGenres) return null;
        var top = Object.keys(m.likedGenres).sort(function (a, b) {
            return m.likedGenres[b] - m.likedGenres[a];
        })[0];
        var threshold = 3;
        if (!top || (m.likedGenres[top] || 0) < threshold) return null;
        if (top === 'horror'  && L.recall_horror_lover)  return pick(L.recall_horror_lover);
        if (top === 'comedy'  && L.recall_comedy_lover)  return pick(L.recall_comedy_lover);
        if (top === 'romance' && L.recall_romance_lover) return pick(L.recall_romance_lover);
        if (top === 'book'    && L.recall_book_lover)    return pick(L.recall_book_lover);
        return null;
    }

    // ----- Backend sync (account-bound when logged in) -----
    function getAuthToken() {
        try {
            // Common keys used by auth.js across the codebase
            return localStorage.getItem('picksy_token') ||
                   localStorage.getItem('pfm_token') ||
                   localStorage.getItem('token') ||
                   (global.Auth && (global.Auth.token || (global.Auth.user && global.Auth.user.token))) ||
                   '';
        } catch (e) { return ''; }
    }

    function apiBase() {
        try {
            if (global.API && (global.API.BASE || global.API.base)) return global.API.BASE || global.API.base;
            if (global.PICKSY_API_BASE) return global.PICKSY_API_BASE;
        } catch (e) {}
        return '';
    }

    var _syncTimer = null;
    function scheduleSync() {
        if (_syncTimer) return;
        _syncTimer = setTimeout(function () {
            _syncTimer = null;
            try { syncMemory(); } catch (e) {}
        }, 1500); // debounce — coalesce rapid writes
    }

    function syncMemory() {
        var token = getAuthToken();
        if (!token) return Promise.resolve(null);
        var m = readMemory();
        var url = apiBase() + '/api/mascot/state';
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ state: m })
        }).then(function (r) {
            if (!r.ok) return null;
            return r.json();
        }).then(function (data) {
            if (data && data.state) {
                // Merge server-side memory in (server is the source of truth for cross-device)
                var merged = Object.assign({}, m, data.state, {
                    // local fields always win for transient counters
                    visits: Math.max(m.visits || 0, data.state.visits || 0),
                    clicks: Math.max(m.clicks || 0, data.state.clicks || 0),
                    picks:  Math.max(m.picks  || 0, data.state.picks  || 0),
                    lastSeen: Math.max(m.lastSeen || 0, data.state.lastSeen || 0)
                });
                merged.synced = true;
                writeMemory(merged);
            }
            return data;
        }).catch(function () { return null; });
    }

    function pullMemory() {
        var token = getAuthToken();
        if (!token) return Promise.resolve(null);
        return fetch(apiBase() + '/api/mascot/state', {
            headers: { 'Authorization': 'Bearer ' + token }
        }).then(function (r) {
            if (!r.ok) return null;
            return r.json();
        }).then(function (data) {
            if (data && data.state) {
                var local = readMemory();
                // Server is authoritative for personal/named fields, local owns counters
                var merged = Object.assign({}, local, data.state, {
                    visits: Math.max(local.visits || 0, data.state.visits || 0),
                    clicks: Math.max(local.clicks || 0, data.state.clicks || 0),
                    picks:  Math.max(local.picks  || 0, data.state.picks  || 0),
                    lastSeen: Math.max(local.lastSeen || 0, data.state.lastSeen || 0)
                });
                merged.synced = true;
                writeMemory(merged);
            }
            return data;
        }).catch(function () { return null; });
    }

    // ----- AI line generation (backend-powered, optional) -----
    function aiLine(prompt, ctx) {
        var token = getAuthToken();
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        return fetch(apiBase() + '/api/mascot/line', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                prompt: prompt || '',
                lang: lang(),
                context: ctx || {},
                memory: summarizeMemory()
            })
        }).then(function (r) {
            if (!r.ok) throw new Error('mascot/line failed');
            return r.json();
        }).then(function (data) {
            return (data && data.line) || '';
        }).catch(function () {
            // Graceful fallback to a static line
            if (ctx && ctx.fallback_context) return phrase(ctx.fallback_context);
            return phrase('ai_generic');
        });
    }

    function summarizeMemory() {
        var m = readMemory();
        // Compact, anonymized summary for AI prompt
        return {
            visits: m.visits, clicks: m.clicks, picks: m.picks,
            userName: m.userName || '',
            likedGenres: m.likedGenres || {},
            recent: (m.recentItems || []).slice(-5).map(function (x) { return x.t + ' (' + x.k + ')'; })
        };
    }

    // ===========================================================
    // SVG markup — single source of truth for the reel character
    // ===========================================================
    function svg(opts) {
        opts = opts || {};
        var label = opts.label || PHRASES[lang()].label;
        return [
            '<svg viewBox="0 0 200 200" role="img" aria-label="' + escapeAttr(label) + '" xmlns="http://www.w3.org/2000/svg">',
              '<title>' + escapeHtml(label) + '</title>',
              '<desc>' + escapeHtml('Picksy — round film-reel mascot with expressive eyes.') + '</desc>',
              '<defs>',
                '<radialGradient id="picksy-body" cx="50%" cy="40%" r="62%">',
                  '<stop offset="0%"  stop-color="#c4a8ff"/>',
                  '<stop offset="55%" stop-color="#8b5cf6"/>',
                  '<stop offset="100%" stop-color="#5b21b6"/>',
                '</radialGradient>',
                '<radialGradient id="picksy-rim" cx="50%" cy="50%" r="50%">',
                  '<stop offset="60%" stop-color="rgba(255,255,255,0)"/>',
                  '<stop offset="100%" stop-color="rgba(236,72,153,.7)"/>',
                '</radialGradient>',
                '<linearGradient id="picksy-cheek" x1="0" x2="1" y1="0" y2="1">',
                  '<stop offset="0%" stop-color="#ec4899" stop-opacity=".55"/>',
                  '<stop offset="100%" stop-color="#f472b6" stop-opacity=".15"/>',
                '</linearGradient>',
              '</defs>',
              '<circle cx="100" cy="100" r="84" fill="url(#picksy-body)"/>',
              '<circle cx="100" cy="100" r="84" fill="url(#picksy-rim)" opacity=".7"/>',
              '<circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="2"/>',
              perforations(),
              '<circle cx="100" cy="100" r="50" fill="rgba(26,16,51,.85)" stroke="rgba(255,255,255,.12)" stroke-width="2"/>',
              '<circle cx="100" cy="100" r="10" fill="#1a0d3d" stroke="rgba(255,255,255,.3)" stroke-width="2"/>',
              '<ellipse class="picksy-cheek" cx="58"  cy="120" rx="14" ry="8" fill="url(#picksy-cheek)"/>',
              '<ellipse class="picksy-cheek" cx="142" cy="120" rx="14" ry="8" fill="url(#picksy-cheek)"/>',
              '<rect class="picksy-brow left"  x="60"  y="76" width="22" height="5" rx="2.5"/>',
              '<rect class="picksy-brow right" x="118" y="76" width="22" height="5" rx="2.5"/>',
              // Eye positions live on an OUTER group whose transform attribute
              // SVG always honors; the styled .picksy-eye class moves to the
              // INNER group so CSS blink/mood transforms don't clobber the
              // translate (which used to detach a whole eye to viewport 0,0
              // — the infamous "floating eye" bug).
              '<g class="picksy-eye-pos left" transform="translate(70 100)">',
                '<g class="picksy-eye left">',
                  '<ellipse cx="0" cy="0" rx="11" ry="13" fill="#fff"/>',
                  '<circle  cx="0" cy="2" r="7" class="picksy-pupil"/>',
                  '<circle  cx="2" cy="-2" r="2.4" class="picksy-eye-shine"/>',
                '</g>',
              '</g>',
              '<g class="picksy-eye-pos right" transform="translate(130 100)">',
                '<g class="picksy-eye right">',
                  '<ellipse cx="0" cy="0" rx="11" ry="13" fill="#fff"/>',
                  '<circle  cx="0" cy="2" r="7" class="picksy-pupil"/>',
                  '<circle  cx="2" cy="-2" r="2.4" class="picksy-eye-shine"/>',
                '</g>',
              '</g>',
              '<path class="picksy-mouth picksy-mouth-happy"   d="M 82 130 Q 100 148 118 130"/>',
              '<path class="picksy-mouth picksy-mouth-sad"     d="M 82 138 Q 100 122 118 138"/>',
              '<path class="picksy-mouth picksy-mouth-think"   d="M 86 134 Q 96 132 110 136"/>',
              '<ellipse class="picksy-mouth picksy-mouth-shocked" cx="100" cy="134" rx="6" ry="8" fill="#1a0d3d" stroke="none"/>',
              '<path class="picksy-mouth picksy-mouth-tired"   d="M 86 134 L 114 134"/>',
              '<path class="picksy-mouth picksy-mouth-wink"    d="M 82 132 Q 100 146 118 130"/>',
              '<path class="picksy-mouth picksy-mouth-smirk"   d="M 86 134 Q 104 142 118 130"/>',
              '<g opacity=".85">',
                '<path d="M 158 56 L 162 64 L 170 68 L 162 72 L 158 80 L 154 72 L 146 68 L 154 64 Z" fill="#fbbf24"/>',
              '</g>',
            '</svg>'
        ].join('');
    }

    function perforations() {
        var out = '';
        for (var i = 0; i < 12; i++) {
            var a = (i / 12) * Math.PI * 2;
            var x = 100 + Math.cos(a) * 72;
            var y = 100 + Math.sin(a) * 72;
            out += '<rect x="' + (x - 3) + '" y="' + (y - 2) + '" width="6" height="4" rx="1" fill="rgba(255,255,255,.18)"/>';
        }
        return out;
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escapeAttr(s) {
        return escapeHtml(s).replace(/"/g, '&quot;');
    }

    // -----------------------------------------------------------
    // Render mascot DOM into a target
    // -----------------------------------------------------------
    function render(target, opts) {
        opts = opts || {};
        var el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el) return null;
        var size = opts.size || 'md';
        var mood = opts.mood || 'happy';
        var label = opts.label || PHRASES[lang()].label;
        var html = '<div class="picksy-mascot" data-size="' + escapeAttr(size) + '" data-mood="' + escapeAttr(mood) + '" aria-label="' + escapeAttr(label) + '" role="img">' +
                   '<div class="picksy-figure">' + svg({ label: label }) + '</div>' +
                   (opts.strip ? '<div class="picksy-strip" aria-hidden="true"></div>' : '') +
                   (opts.bubble ? bubbleHtml(opts.bubble, opts.intro) : '') +
                   '</div>';
        if (opts.replace) {
            el.innerHTML = html;
        } else {
            el.insertAdjacentHTML(opts.position || 'beforeend', html);
        }
        return el.querySelector('.picksy-mascot');
    }

    function bubbleHtml(text, intro) {
        var introLabel = intro || PHRASES[lang()].ai_intro;
        return '<div class="picksy-bubble"><small>' + escapeHtml(introLabel) + '</small>' + escapeHtml(text) + '</div>';
    }

    function setMood(target, mood) {
        var el = typeof target === 'string' ? document.querySelector(target) : target;
        if (!el || !el.classList || !el.classList.contains('picksy-mascot')) {
            if (el) el = el.querySelector('.picksy-mascot');
        }
        if (!el) return;
        if (MOODS.indexOf(mood) === -1) mood = 'happy';
        el.setAttribute('data-mood', mood);
    }

    function setBubble(target, text, intro) {
        var root = typeof target === 'string' ? document.querySelector(target) : target;
        if (!root) return;
        var host = root.classList && root.classList.contains('picksy-mascot') ? root : root.querySelector('.picksy-mascot');
        if (!host) return;
        var bubble = host.querySelector('.picksy-bubble');
        if (!bubble) {
            host.insertAdjacentHTML('beforeend', bubbleHtml(text, intro));
        } else {
            var introLabel = intro || PHRASES[lang()].ai_intro;
            bubble.innerHTML = '<small>' + escapeHtml(introLabel) + '</small>' + escapeHtml(text);
            bubble.style.animation = 'none';
            void bubble.offsetHeight;
            bubble.style.animation = '';
        }
    }

    // -----------------------------------------------------------
    // Phrase selector
    //
    // Signature:  phrase(context, optsOrLang?)
    //   context     - 'hero' | 'hero_returning' | 'loading' | 'empty_saved'
    //                 | 'empty_collections' | 'ai_generic' | <any PHRASES key>
    //   optsOrLang  - either a language string ('uk'|'en') for backward
    //                 compatibility, or an opts object:
    //                   { lang?: 'uk'|'en', type?: 'movie'|'tv'|'book' }
    //                 When context === 'loading' and opts.type is set,
    //                 the type-specific pool is used (loading_movie, etc.)
    //                 with the generic pool as a fallback.
    // -----------------------------------------------------------
    //
    // pool(staticArr, generatorBucket) merges generated lines into a static
    // pool so phrase() can pick from a wider, ever-fresh set. Generator is
    // skipped (pool returns the original array) if the bucket has no
    // generator templates defined.
    //
    function _augmentedPool(staticArr, genBucket, langCode) {
        var arr = (staticArr || []).slice();
        try {
            var enKey = genBucket + '_en';
            var hasGen = !!(GEN_TEMPLATES[genBucket] || (langCode === 'en' && GEN_TEMPLATES[enKey]));
            if (!hasGen) return arr;
            // Add ~5 generated alternatives to the pool. pickFresh's anti-repeat
            // tracking handles deduplication across calls.
            var generated = generateMany(genBucket, 5, { lang: langCode });
            for (var i = 0; i < generated.length; i++) {
                if (arr.indexOf(generated[i]) === -1) arr.push(generated[i]);
            }
        } catch (e) {}
        return arr;
    }

    function phrase(context, optsOrLang) {
        var opts = (optsOrLang && typeof optsOrLang === 'object') ? optsOrLang : null;
        var langCode = opts ? (opts.lang || lang()) : (optsOrLang || lang());
        var L = PHRASES[langCode] || PHRASES.uk;
        var type = opts ? opts.type : null;
        if (context === 'hero') {
            var bucket = timeBucket();
            var pool = _augmentedPool(L.hero[bucket] || L.hero.day, 'hero', langCode);
            return pickFresh(pool, 'hero.' + bucket + '.' + langCode);
        }
        if (context === 'hero_returning') {
            return pickFresh(_augmentedPool(L.hero.returning || L.hero.day, 'hero', langCode), 'hero.returning.' + langCode);
        }
        if (context === 'loading') {
            if (type === 'movie' && L.loading_movie && L.loading_movie.length) {
                return pickFresh(_augmentedPool(L.loading_movie, 'loading_movie', langCode), 'loading_movie.' + langCode);
            }
            if (type === 'tv' && L.loading_tv && L.loading_tv.length) {
                return pickFresh(_augmentedPool(L.loading_tv, 'loading_tv', langCode), 'loading_tv.' + langCode);
            }
            if (type === 'book' && L.loading_book && L.loading_book.length) {
                return pickFresh(_augmentedPool(L.loading_book, 'loading_book', langCode), 'loading_book.' + langCode);
            }
            return pickFresh(_augmentedPool(L.loading, 'loading', langCode), 'loading.' + langCode);
        }
        if (context === 'empty_saved')        return pickFresh(_augmentedPool(L.empty_saved, 'empty_saved', langCode), 'empty_saved.' + langCode);
        if (context === 'empty_collections')  return pickFresh(L.empty_collections, 'empty_collections.' + langCode);
        if (context === 'ai_generic')         return pickFresh(_augmentedPool(L.ai_commentary.generic, 'ai_generic', langCode), 'ai.generic.' + langCode);
        if (context === 'fab_tickle')         return pickFresh(_augmentedPool(L.fab_tickle, 'fab_tickle', langCode), 'fab_tickle.' + langCode);
        if (L[context])                       return pickFresh(L[context], context + '.' + langCode);
        return '';
    }

    function greet() {
        var b = timeBucket();
        var m = readMemory();
        // Returning user with prior picks gets a familiar greeting half the time
        if (m && m.visits > 1 && (m.picks > 0 || m.clicks > 3) && Math.random() < 0.5) {
            return { phrase: phrase('hero_returning'), mood: 'wink', bucket: b };
        }
        return { phrase: phrase('hero'), mood: moodForBucket(b), bucket: b };
    }

    // ===========================================================
    // AI commentary — analyzes the picked item and picks a line
    // ===========================================================
    function commentary(item, type) {
        if (!item) return phrase('ai_generic');
        var L = PHRASES[lang()] || PHRASES.uk;
        var cat = inferCategory(item, type);
        var pool = (L.ai_commentary[cat] || []).concat(L.ai_commentary.generic);
        return pickFresh(pool, 'ai.' + cat + '.' + lang());
    }

    function inferCategory(item, type) {
        if (!item) return 'generic';
        if (type === 'book') return 'book';
        if (type === 'tv')   return 'tv';
        var origLang = (item.original_language || '').toLowerCase();
        var genres = (item.genre_ids || []).map(Number);
        if (genres.indexOf(16) !== -1 && origLang === 'ja') return 'anime';
        if (genres.indexOf(99) !== -1) return 'doc';
        if (genres.indexOf(27) !== -1) return 'horror';
        if (genres.indexOf(53) !== -1) return 'horror';
        if (genres.indexOf(35) !== -1) return 'comedy';
        if (genres.indexOf(10749) !== -1) return 'romance';
        if (genres.indexOf(18) !== -1) return 'drama';
        if (genres.indexOf(28) !== -1) return 'action';
        if (genres.indexOf(12) !== -1) return 'action';
        if (genres.indexOf(878) !== -1) return 'scifi';
        if (genres.indexOf(14) !== -1) return 'scifi';
        return 'generic';
    }

    // -----------------------------------------------------------
    // Commentary card — appended near a result card
    // -----------------------------------------------------------
    function showCommentary(target, text, opts) {
        opts = opts || {};
        var host = typeof target === 'string' ? document.querySelector(target) : target;
        if (!host) return null;
        var prev = host.querySelector('.picksy-commentary');
        if (prev) prev.remove();
        var L = PHRASES[lang()] || PHRASES.uk;
        var introLabel = opts.intro || L.ai_intro;
        var mood = opts.mood || pickMoodForCommentary();
        var html = '<aside class="picksy-commentary" role="note" aria-label="' + escapeAttr(L.label) + '">' +
                     '<div class="picksy-mascot" data-size="sm" data-mood="' + escapeAttr(mood) + '" role="img" aria-label="' + escapeAttr(L.label) + '">' +
                       '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                     '</div>' +
                     '<div class="picksy-commentary-text"><small>' + escapeHtml(introLabel) + '</small>' + escapeHtml(text) + '</div>' +
                     '<button class="picksy-commentary-close" aria-label="' + escapeAttr(L.close_label) + '" title="' + escapeAttr(L.close_label) + '">\u00d7</button>' +
                   '</aside>';
        var moreBtn = host.querySelector('#more-btn');
        if (moreBtn && moreBtn.parentNode === host) {
            moreBtn.insertAdjacentHTML('beforebegin', html);
        } else {
            host.insertAdjacentHTML('beforeend', html);
        }
        var node = host.querySelector('.picksy-commentary');
        if (node) {
            var closeBtn = node.querySelector('.picksy-commentary-close');
            if (closeBtn) closeBtn.addEventListener('click', function () {
                node.style.opacity = '0';
                node.style.transform = 'translateY(8px)';
                setTimeout(function () { node.remove(); }, 250);
            });
            setTimeout(function () {
                var mEl = node.querySelector('.picksy-mascot');
                if (mEl) mEl.setAttribute('data-mood', pickMoodForCommentary());
            }, 2500);
        }
        return node;
    }

    function pickMoodForCommentary() {
        var moods = ['smirk', 'wink', 'happy', 'excited'];
        return moods[Math.floor(Math.random() * moods.length)];
    }

    // -----------------------------------------------------------
    // Loading-overlay mascot
    // -----------------------------------------------------------
    var _loadingType = null;                   // 'movie' | 'tv' | 'book' | null
    var _loadingAiCache = { line: '', ts: 0, key: '' };
    var _loadingAiInflight = false;
    var _loadingCycleCount = 0;
    function _normalizeLoadingType(t) {
        if (!t) return null;
        t = String(t).toLowerCase();
        if (t === 'movies' || t === 'film' || t === 'films') return 'movie';
        if (t === 'series' || t === 'show' || t === 'shows') return 'tv';
        if (t === 'books') return 'book';
        if (t === 'movie' || t === 'tv' || t === 'book') return t;
        return null;
    }
    function _detectLoadingType() {
        // Look at globally exposed App state first, fall back to body classes.
        try {
            if (global.App) {
                var t = _normalizeLoadingType(global.App.currentType);
                if (t) return t;
                t = _normalizeLoadingType(global.App.currentTab);
                if (t) return t;
            }
        } catch (e) {}
        try {
            var b = document.body;
            if (b) {
                if (b.classList.contains('tab-books') || b.dataset.tab === 'books') return 'book';
                if (b.classList.contains('tab-tv') || b.dataset.tab === 'tv') return 'tv';
                if (b.classList.contains('tab-movies') || b.dataset.tab === 'movies') return 'movie';
            }
        } catch (e) {}
        return null;
    }
    function mountLoadingMascot(type) {
        _loadingType = _normalizeLoadingType(type) || _detectLoadingType();
        _loadingCycleCount = 0;
        var loading = document.getElementById('loading');
        if (!loading) return;
        if (loading.querySelector('.picksy-mascot')) {
            // Already mounted — just refresh the line for the new type.
            var el = loading.querySelector('.picksy-loading-text');
            if (el) el.textContent = phrase('loading', { type: _loadingType });
            startLoadingPhraseCycle();
            return;
        }
        var inner = loading.querySelector('.loading-inner');
        if (!inner) return;
        var L = PHRASES[lang()] || PHRASES.uk;
        var html = '<div class="picksy-loading-content">' +
                     '<div class="picksy-mascot" data-size="md" data-mood="thinking" role="img" aria-label="' + escapeAttr(L.label) + '">' +
                       '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                     '</div>' +
                     '<div class="picksy-bubble"><small>' + escapeHtml(L.ai_intro) + '</small>' +
                       '<span class="picksy-loading-text">' + escapeHtml(phrase('loading', { type: _loadingType })) + '</span>' +
                       '<span class="picksy-thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
                     '</div>' +
                   '</div>';
        inner.innerHTML = html;
        startLoadingPhraseCycle();
    }

    // Ask the backend for a fresh AI-generated loading line.
    // Cached for 60s per (lang, type) key so we don't burn tokens on every
    // tick of the 2.2s cycle.
    function _refreshLoadingAiLine() {
        var key = lang() + '|' + (_loadingType || 'any');
        var now = Date.now();
        if (_loadingAiInflight) return;
        if (_loadingAiCache.key === key && (now - _loadingAiCache.ts) < 60000) return;
        _loadingAiInflight = true;
        var topicMap = {
            movie: 'You are picking a movie. Generate ONE short, witty in-character loading line.',
            tv:    'You are picking a TV series. Generate ONE short, witty in-character loading line.',
            book:  'You are picking a book. Generate ONE short, witty in-character loading line.'
        };
        var topic = topicMap[_loadingType] || 'Generate ONE short, witty in-character loading line.';
        aiLine(topic, {
            mode: 'loading',
            content_type: _loadingType || 'any',
            fallback_context: 'loading'
        }).then(function (line) {
            _loadingAiInflight = false;
            if (line && typeof line === 'string') {
                _loadingAiCache = { line: line.trim(), ts: Date.now(), key: key };
            }
        }).catch(function () { _loadingAiInflight = false; });
    }

    var _loadingTimer = null;
    function startLoadingPhraseCycle() {
        stopLoadingPhraseCycle();
        // Kick off an AI line request in the background — the cycle will
        // surface it on its next tick if it arrives in time.
        try { _refreshLoadingAiLine(); } catch (e) {}
        _loadingTimer = setInterval(function () {
            var el = document.querySelector('#loading .picksy-loading-text');
            if (!el) { stopLoadingPhraseCycle(); return; }
            _loadingCycleCount++;
            // Every 3rd tick try an AI line if we have one cached for this
            // (lang, type) combo — keeps the cycle feeling alive without
            // hammering the API.
            var aiKey = lang() + '|' + (_loadingType || 'any');
            var useAi = (_loadingCycleCount % 3 === 0)
                        && _loadingAiCache.line
                        && _loadingAiCache.key === aiKey;
            if (useAi) {
                el.textContent = _loadingAiCache.line;
                // Invalidate so we don't repeat the same AI line on the next
                // matching tick — background refresh will fetch a new one.
                _loadingAiCache = { line: '', ts: 0, key: '' };
                try { _refreshLoadingAiLine(); } catch (e) {}
            } else {
                el.textContent = phrase('loading', { type: _loadingType });
            }
            // Subtle mood switch — keeps it alive
            var mEl = document.querySelector('#loading .picksy-mascot');
            if (mEl && Math.random() < 0.35) {
                var m = pick(['thinking', 'happy', 'smirk', 'excited']);
                mEl.setAttribute('data-mood', m);
            }
        }, 2200);
    }
    function stopLoadingPhraseCycle() {
        if (_loadingTimer) { clearInterval(_loadingTimer); _loadingTimer = null; }
    }

    // -----------------------------------------------------------
    // Hero placement
    // -----------------------------------------------------------
    function mountHero() {
        var hero = document.getElementById('hero-section');
        if (!hero) return;
        var existing = hero.querySelector('.picksy-hero-wrap');
        var g = greet();
        if (existing) {
            setMood(existing, g.mood);
            setBubble(existing, g.phrase, PHRASES[lang()].greet_name);
            return;
        }
        var oldCta = document.getElementById('hero-cta-btn');
        var L = PHRASES[lang()] || PHRASES.uk;
        var ctaLabel = (global.I18N && global.I18N.t) ? global.I18N.t('heroCta') : 'Підібрати зараз';
        var ctaHtml = '<div class="picksy-hero-wrap" id="hero-mascot-wrap">' +
                        '<div class="picksy-mascot" id="hero-mascot" data-size="lg" data-mood="' + escapeAttr(g.mood) + '" role="img" aria-label="' + escapeAttr(L.label) + '" tabindex="0">' +
                          '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                          '<div class="picksy-strip" aria-hidden="true"></div>' +
                          '<div class="picksy-bubble"><small>' + escapeHtml(L.greet_name) + '</small>' + escapeHtml(g.phrase) + '</div>' +
                        '</div>' +
                        '<button type="button" class="picksy-hero-cta" id="hero-cta-btn" aria-label="' + escapeAttr(ctaLabel) + '">' +
                          '<span aria-hidden="true">🎬</span>' +
                          '<span data-i18n="heroCta">' + escapeHtml(ctaLabel) + '</span>' +
                        '</button>' +
                      '</div>';
        if (oldCta) {
            oldCta.outerHTML = ctaHtml;
        } else {
            hero.insertAdjacentHTML('beforeend', ctaHtml);
        }
        var mascot = document.getElementById('hero-mascot');
        if (mascot) {
            // Cycle through ALL moods on click so every tap visibly changes
            // the face (eyes/mouth/brows/animation speed). Previously the
            // click flashed a single alt-mood for 1.4s and reverted, which
            // felt like nothing changed when users tapped repeatedly.
            var cycle = ['happy', 'excited', 'wink', 'thinking', 'shocked', 'smirk', 'sad', 'tired'];
            var idx = cycle.indexOf(mascot.getAttribute('data-mood'));
            if (idx < 0) idx = 0;
            var clickHandler = function () {
                memoryBump('clicks');
                idx = (idx + 1) % cycle.length;
                var nextMood = cycle[idx];
                setMood(mascot, nextMood);
                var recalled = memoryRecall();
                var line = (recalled && Math.random() < 0.4) ? recalled : phrase('hero');
                setBubble(mascot, line, L.greet_name);
                // Brief tactile "boop" animation that's visible regardless of mood.
                mascot.classList.remove('picksy-hero-boop');
                void mascot.offsetWidth;
                mascot.classList.add('picksy-hero-boop');
                maybeMilestone(mascot);
            };
            mascot.addEventListener('click', clickHandler);
            mascot.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(); }
            });
        }
    }

    function maybeMilestone(mascotEl) {
        var m = readMemory();
        var L = PHRASES[lang()] || PHRASES.uk;
        var line = null;
        if (m.clicks === 10  && L.milestone_10)  line = pick(L.milestone_10);
        else if (m.clicks === 50  && L.milestone_50)  line = pick(L.milestone_50);
        else if (m.clicks === 100 && L.milestone_100) line = pick(L.milestone_100);
        if (line && mascotEl) {
            setBubble(mascotEl, line, L.greet_name);
            setMood(mascotEl, 'shocked');
        }
    }

    // -----------------------------------------------------------
    // Saved empty-state replacement
    // -----------------------------------------------------------
    function decorateEmptyList(target) {
        var host = typeof target === 'string' ? document.querySelector(target) : target;
        if (!host) return;
        var emptyMsg = host.querySelector('.empty-msg:not(.picksy-handled)');
        if (!emptyMsg) return;
        var L = PHRASES[lang()] || PHRASES.uk;
        var line = phrase('empty_saved');
        var wrap = document.createElement('div');
        wrap.className = 'picksy-empty';
        wrap.innerHTML =
            '<div class="picksy-mascot" data-size="md" data-mood="sad" role="img" aria-label="' + escapeAttr(L.label) + '">' +
              '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
            '</div>' +
            '<div class="picksy-bubble"><small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(line) + '</div>';
        emptyMsg.classList.add('picksy-handled');
        emptyMsg.setAttribute('aria-hidden', 'false');
        emptyMsg.style.opacity = '0.55';
        emptyMsg.style.fontSize = '.78rem';
        emptyMsg.style.marginTop = '4px';
        var parent = emptyMsg.parentNode;
        parent.insertBefore(wrap, emptyMsg);
    }

    function observeSavedList() {
        var list = document.getElementById('saved-list');
        if (!list || list._picksyObserved) return;
        list._picksyObserved = true;
        var mo = new MutationObserver(function () {
            if (list.children.length === 1 && list.firstElementChild &&
                list.firstElementChild.classList.contains('empty-msg') &&
                !list.firstElementChild.classList.contains('picksy-handled')) {
                decorateEmptyList(list);
            }
        });
        mo.observe(list, { childList: true });
        decorateEmptyList(list);
    }

    // ===========================================================
    // Floating Picksy (FAB) — REMOVED.
    //
    // The mascot used to live as a permanent floating button in the
    // corner of every page, but it clashed with the existing fire-menu
    // FAB and felt redundant. Picksy now only appears inline:
    // hero card, loading overlays, commentary cards, quiz / match / 404
    // pages, share cards, etc.
    //
    // `mountFab` is kept as a no-op so any external caller (or stale
    // cached script) won't crash. It also defensively removes any
    // leftover .picksy-fab nodes from older builds.
    // ===========================================================
    function mountFab() {
        try {
            var stale = document.querySelectorAll('.picksy-fab, .picksy-fab-bubble');
            for (var i = 0; i < stale.length; i++) {
                stale[i].parentNode && stale[i].parentNode.removeChild(stale[i]);
            }
        } catch (e) {}
    }

    // ===========================================================
    // Page-specific helpers
    // ===========================================================

    // Quiz (Архетип) — intro card + per-answer commentary + result card
    function mountQuiz() {
        if (!document.body.classList.contains('picksy-quiz') &&
            !document.querySelector('.quiz-shell, #quiz-stage')) return;
        // Inject an intro card above the stage if not present
        var stage = document.getElementById('quiz-stage');
        if (!stage) return;
        var L = PHRASES[lang()] || PHRASES.uk;
        if (!document.querySelector('.picksy-quiz-intro')) {
            var intro = document.createElement('aside');
            intro.className = 'picksy-quiz-intro picksy-commentary';
            intro.setAttribute('role', 'note');
            intro.setAttribute('aria-label', L.label);
            intro.innerHTML =
                '<div class="picksy-mascot" data-size="sm" data-mood="excited" role="img" aria-label="' + escapeAttr(L.label) + '">' +
                  '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                '</div>' +
                '<div class="picksy-commentary-text"><small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(phrase('quiz_intro')) + '</div>';
            stage.parentNode.insertBefore(intro, stage);
        }
        // Watch for answer clicks — when an answer is picked, swap line briefly
        document.addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.quiz-answer');
            if (!btn) return;
            var introCard = document.querySelector('.picksy-quiz-intro .picksy-commentary-text');
            if (!introCard) return;
            var line = phrase('quiz_progress');
            introCard.innerHTML = '<small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(line);
            var mEl = document.querySelector('.picksy-quiz-intro .picksy-mascot');
            if (mEl) mEl.setAttribute('data-mood', pick(['smirk', 'wink', 'shocked', 'happy']));
        });
        // Watch for the result card mount via MutationObserver
        var mo = new MutationObserver(function () {
            if (document.querySelector('.quiz-result-card, .quiz-result, [data-quiz-result]')) {
                addQuizResultCommentary();
                mo.disconnect();
            }
        });
        mo.observe(stage, { childList: true, subtree: true });
    }

    function addQuizResultCommentary() {
        var stage = document.getElementById('quiz-stage');
        if (!stage) return;
        if (stage.querySelector('.picksy-commentary.picksy-quiz-result')) return;
        var L = PHRASES[lang()] || PHRASES.uk;
        var line = phrase('quiz_result');
        var aside = document.createElement('aside');
        aside.className = 'picksy-commentary picksy-quiz-result';
        aside.setAttribute('role', 'note');
        aside.innerHTML =
            '<div class="picksy-mascot" data-size="sm" data-mood="excited" role="img" aria-label="' + escapeAttr(L.label) + '">' +
              '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
            '</div>' +
            '<div class="picksy-commentary-text"><small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(line) + '</div>';
        stage.appendChild(aside);
    }

    // Match (Сумісність) — intro + result commentary
    function mountMatch() {
        if (!document.body.classList.contains('picksy-match') &&
            !document.querySelector('#match-stage, .match-shell, .match-page')) return;
        var L = PHRASES[lang()] || PHRASES.uk;
        var host = document.querySelector('#match-stage, .match-shell main, main.match-page, .match-page main, .match-shell, .match-page') ||
                   document.body;
        if (!document.querySelector('.picksy-match-intro')) {
            var aside = document.createElement('aside');
            aside.className = 'picksy-commentary picksy-match-intro';
            aside.innerHTML =
                '<div class="picksy-mascot" data-size="sm" data-mood="wink" role="img" aria-label="' + escapeAttr(L.label) + '">' +
                  '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                '</div>' +
                '<div class="picksy-commentary-text"><small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(phrase('match_intro')) + '</div>';
            host.insertBefore(aside, host.firstChild);
        }
        // Observe DOM for a results screen and append commentary
        var mo = new MutationObserver(function () {
            var pctEl = document.querySelector('[data-match-percent], .match-percent, .match-score-percent, .match-score-pct');
            var existing = document.querySelector('.picksy-match-result');
            if (pctEl && !existing) {
                var pct = parseInt((pctEl.textContent || '').replace(/[^0-9]/g, ''), 10);
                var bucket = 'match_mid';
                if (pct >= 70) bucket = 'match_high';
                else if (pct < 40) bucket = 'match_low';
                var line = phrase(bucket);
                var holder = pctEl.closest('section, .card, .match-result, main') || host;
                var card = document.createElement('aside');
                card.className = 'picksy-commentary picksy-match-result';
                card.innerHTML =
                    '<div class="picksy-mascot" data-size="sm" data-mood="' + (pct >= 70 ? 'excited' : pct >= 40 ? 'happy' : 'smirk') + '" role="img" aria-label="' + escapeAttr(L.label) + '">' +
                      '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                    '</div>' +
                    '<div class="picksy-commentary-text"><small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(line) + '</div>';
                holder.appendChild(card);
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // Game / Wordle — append commentary on win / loss
    function mountGame(opts) {
        opts = opts || {};
        var hostSelector = opts.host || '.game-result, .wordle-result, #game-result, #wordle-result';
        var hostFinder = function () { return document.querySelector(hostSelector); };
        var bucketFor = opts.bucketFor || function (host) {
            if (host.classList.contains('win') || host.dataset.result === 'win') return 'wordle_win';
            if (host.classList.contains('lose') || host.dataset.result === 'lose') return 'wordle_lose';
            return null;
        };
        var mo = new MutationObserver(function () {
            var host = hostFinder();
            if (!host) return;
            if (host.querySelector('.picksy-commentary')) return;
            var b = bucketFor(host);
            if (!b) return;
            var L = PHRASES[lang()] || PHRASES.uk;
            var card = document.createElement('aside');
            card.className = 'picksy-commentary';
            card.innerHTML =
                '<div class="picksy-mascot" data-size="sm" data-mood="' + (b.indexOf('win') >= 0 ? 'excited' : 'sad') + '" role="img" aria-label="' + escapeAttr(L.label) + '">' +
                  '<div class="picksy-figure">' + svg({ label: L.label }) + '</div>' +
                '</div>' +
                '<div class="picksy-commentary-text"><small>' + escapeHtml(L.ai_intro) + '</small>' + escapeHtml(phrase(b)) + '</div>';
            host.appendChild(card);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // -----------------------------------------------------------
    // Patch UI.showLoading / hideLoading / showResult (index.html only)
    // -----------------------------------------------------------
    function resolveUI() {
        if (global.UI) return global.UI;
        try { if (typeof UI !== 'undefined') return UI; } catch (e) {}
        return null;
    }

    function patchUI() {
        var U = resolveUI();
        if (!U || U._picksyPatched) return;
        U._picksyPatched = true;

        var _showLoading = U.showLoading && U.showLoading.bind(U);
        if (_showLoading) U.showLoading = function (text, type) {
            _showLoading(text);
            mountLoadingMascot(type);
        };

        var _hideLoading = U.hideLoading && U.hideLoading.bind(U);
        if (_hideLoading) U.hideLoading = function () {
            stopLoadingPhraseCycle();
            _loadingType = null;
            _hideLoading();
        };

        var _showResult = U.showResult && U.showResult.bind(U);
        if (_showResult) U.showResult = function (item, type) {
            _showResult(item, type);
            try {
                memoryAddPick(item, type);
                var section = document.getElementById('result-section');
                if (!section) return;
                var line = commentary(item, type);
                showCommentary(section, line);
            } catch (e) { /* don't break the result render */ }
        };
    }

    // ===========================================================
    // Public API
    // ===========================================================
    var Picksy = {
        svg: svg,
        render: render,
        setMood: setMood,
        setBubble: setBubble,
        phrase: phrase,
        greet: greet,
        commentary: commentary,
        showCommentary: showCommentary,
        mountLoadingMascot: mountLoadingMascot,
        mountHero: mountHero,
        decorateEmptyList: decorateEmptyList,
        observeSavedList: observeSavedList,
        mountFab: mountFab,
        mountQuiz: mountQuiz,
        mountMatch: mountMatch,
        mountGame: mountGame,
        aiLine: aiLine,
        generate: generate,
        generateMany: generateMany,
        memory: {
            get: memoryGet,
            set: memorySet,
            addPick: memoryAddPick,
            bump: memoryBump,
            sync: syncMemory,
            pull: pullMemory,
            recall: memoryRecall
        },
        moods: MOODS,
        phrases: PHRASES
    };

    global.Picksy = Picksy;

    // -----------------------------------------------------------
    // Auto-init when DOM is ready
    // -----------------------------------------------------------
    function init() {
        // Bump visit counter once per page load
        try {
            var m = readMemory();
            if (!m.firstSeen) m.firstSeen = Date.now();
            m.visits = (m.visits || 0) + 1;
            m.lastSeen = Date.now();
            writeMemory(m);
        } catch (e) {}

        try { mountHero(); } catch (e) {}
        try { observeSavedList(); } catch (e) {}
        try { patchUI(); } catch (e) {}
        try { mountQuiz(); } catch (e) {}
        try { mountMatch(); } catch (e) {}
        try { mountGame(); } catch (e) {}
        // mountFab() is intentionally NOT called — the floating Picksy
        // FAB was removed in favor of inline commentary. We still call
        // it to clean up stale .picksy-fab nodes from older cached builds.
        try { mountFab(); } catch (e) {}

        // Pull server-side memory once if logged in
        try { pullMemory(); } catch (e) {}

        document.addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.lang-btn');
            if (!btn) return;
            setTimeout(function () { try { mountHero(); } catch (e) {} }, 80);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // UI may load after us in rare cases
    setTimeout(function () { try { patchUI(); } catch (e) {} }, 0);
})(typeof window !== 'undefined' ? window : this);
