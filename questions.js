// Quiz content. Edit questions here.
// "answer" is the position of the correct option: 0 = A, 1 = B, 2 = C, 3 = D.
window.QUIZ = {
  title: "Diwali Quiz",
  timeLimitSec: 20,      // seconds per question
  basePoints: 10,        // points for a correct answer
  speedBonus: 5,         // extra points for answering fast (scales down to 0)
  rounds: [
    {
      title: "Diwali Traditions",
      double: false,
      questions: [
        { q: "Lord Rama returned to which city on Diwali?", options: ["Mathura", "Ayodhya", "Ujjain", "Dwarka"], answer: 1 },
        { q: "Buying gold and utensils is considered lucky on which day?", options: ["Bhai Dooj", "Govardhan Puja", "Dhanteras", "Naraka Chaturdashi"], answer: 2 },
        { q: "Which demon's defeat is celebrated on Naraka Chaturdashi?", options: ["Ravana", "Mahishasura", "Kansa", "Narakasura"], answer: 3 },
        { q: "Govardhan Puja recalls Krishna lifting a hill to protect people from which god's rain?", options: ["Indra", "Varuna", "Vayu", "Surya"], answer: 0 },
        { q: "Bhai Dooj celebrates the bond between...", options: ["Husband and wife", "Brother and sister", "Teacher and student", "Friends"], answer: 1 }
      ]
    },
    {
      title: "Startup World",
      double: false,
      questions: [
        { q: "Flipkart started by selling which product?", options: ["Mobile phones", "Clothes", "Books", "Electronics"], answer: 2 },
        { q: "Which city is called the Silicon Valley of India?", options: ["Hyderabad", "Bengaluru", "Pune", "Chennai"], answer: 1 },
        { q: "Ritesh Agarwal is the founder of which startup?", options: ["OYO", "Ola", "Zomato", "Paytm"], answer: 0 },
        { q: "A 'unicorn' startup is valued at...", options: ["$10 million or more", "$100 million or more", "$1 billion or more", "$10 billion or more"], answer: 2 },
        { q: "What was Zomato's original name?", options: ["FoodPanda", "Foodiebay", "TastyKhana", "EatOut"], answer: 1 }
      ]
    },
    {
      title: "Sweets of India",
      double: false,
      questions: [
        { q: "Orange spirals, fried and dipped in sugar syrup. Which sweet?", options: ["Gulab Jamun", "Jalebi", "Rasmalai", "Kalakand"], answer: 1 },
        { q: "Diamond-shaped cashew sweet, often with silver foil. Which sweet?", options: ["Kaju Katli", "Soan Papdi", "Mysore Pak", "Peda"], answer: 0 },
        { q: "Petha is a famous sweet from which city?", options: ["Jaipur", "Lucknow", "Agra", "Varanasi"], answer: 2 },
        { q: "Pootharekulu comes from which village in Andhra Pradesh?", options: ["Atreyapuram", "Tapeswaram", "Kakinada", "Araku"], answer: 0 },
        { q: "Rasgulla is made mainly from...", options: ["Khoya", "Chhena", "Rice flour", "Besan"], answer: 1 }
      ]
    },
    {
      title: "Vizag Rapid Fire",
      double: true,
      questions: [
        { q: "Which long-range Navy aircraft is now a museum on Beach Road?", options: ["MiG-21", "TU-142", "Boeing 737", "Jaguar"], answer: 1 },
        { q: "Borra Caves are located in which hills?", options: ["Nallamala Hills", "Ananthagiri Hills", "Seshachalam Hills", "Horsley Hills"], answer: 1 },
        { q: "The submarine INS Kursura was built by which country?", options: ["USA", "UK", "Soviet Union", "France"], answer: 2 },
        { q: "The deity at Simhachalam is covered in what for most of the year?", options: ["Sandalwood paste", "Turmeric", "Vermilion", "Silver armour"], answer: 0 },
        { q: "Vizag Steel Plant is run by which company?", options: ["SAIL", "RINL", "NMDC", "Tata Steel"], answer: 1 }
      ]
    }
  ]
};
